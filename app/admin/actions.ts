"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  categories,
  diningTables,
  menuItemOptions,
  menuItems,
  settings,
} from "@/db/schema";
import { requireAdmin } from "@/lib/guard";
import { bumpMenuVersion } from "@/lib/queries";
import { slugify } from "@/lib/utils";

/**
 * Admin mutations.
 *
 * Every one of these calls `requireAdmin()` first. A Server Action is a public
 * HTTP endpoint with a generated name — being unreachable from the UI is not
 * access control.
 *
 * Any change to the menu bumps `settings.menuVersion`, which is how offline
 * phones discover there is something new to download.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

async function refreshMenu() {
  await bumpMenuVersion();
  revalidatePath("/");
  revalidatePath("/admin/menu");
}

/* ------------------------------------------------------------- settings */

const settingsSchema = z.object({
  restaurantName: z.string().min(1).max(120),
  tagline: z.string().max(200).nullable(),
  currency: z.string().min(1).max(8),
  taxRate: z.number().min(0).max(1),
  serviceChargeRate: z.number().min(0).max(1),
});

export async function updateSettings(
  input: z.input<typeof settingsSchema>,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those settings look wrong." };

  await db
    .update(settings)
    .set({
      restaurantName: parsed.data.restaurantName,
      tagline: parsed.data.tagline || null,
      currency: parsed.data.currency,
      taxRate: String(parsed.data.taxRate),
      serviceChargeRate: String(parsed.data.serviceChargeRate),
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));

  await refreshMenu();
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** The headline feature: flip the whole app between its two modes. */
export async function setMode(mode: "DISPLAY" | "ORDERING"): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(settings)
    .set({ mode, updatedAt: new Date() })
    .where(eq(settings.id, 1));

  await refreshMenu();
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Temporary stop on new orders without leaving ORDERING mode entirely. */
export async function setAcceptingOrders(
  accepting: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(settings)
    .set({ acceptingOrders: accepting, updatedAt: new Date() })
    .where(eq(settings.id, 1));

  await refreshMenu();
  revalidatePath("/admin");
  return { ok: true };
}

/* ------------------------------------------------------------ categories */

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(400).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCategory(
  input: z.input<typeof categorySchema>,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the category details." };

  const { id, name, description, sortOrder, isActive } = parsed.data;

  if (id) {
    await db
      .update(categories)
      .set({ name, description: description ?? null, sortOrder, isActive })
      .where(eq(categories.id, id));
  } else {
    // Slugs must be unique; add a short suffix rather than failing on a
    // duplicate name like a second "Drinks".
    const base = slugify(name) || "category";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

    await db.insert(categories).values({
      name,
      slug,
      description: description ?? null,
      sortOrder,
      isActive,
    });
  }

  await refreshMenu();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(menuItems)
    .where(eq(menuItems.categoryId, id));

  if (count > 0) {
    return {
      ok: false,
      error: `That category still has ${count} item${count > 1 ? "s" : ""}. Move or remove them first.`,
    };
  }

  await db.delete(categories).where(eq(categories.id, id));
  await refreshMenu();
  return { ok: true };
}

/* ------------------------------------------------------------ menu items */

const optionSchema = z.object({
  groupName: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  priceDelta: z.string().max(20).default("0"),
  isDefault: z.boolean().default(false),
});

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(140),
  description: z.string().max(400).nullable().optional(),
  longDescription: z.string().max(2000).nullable().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a price like 120 or 120.50"),
  imageUrl: z.string().url().max(1000).nullable().optional().or(z.literal("")),
  tags: z.array(z.string().max(30)).max(8).default([]),
  spiceLevel: z.number().int().min(0).max(3).default(0),
  calories: z.number().int().min(0).max(9999).nullable().optional(),
  prepMinutes: z.number().int().min(0).max(999).nullable().optional(),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  options: z.array(optionSchema).max(20).default([]),
});

export async function saveMenuItem(
  input: z.input<typeof itemSchema>,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the item details.",
    };
  }

  const data = parsed.data;

  const values = {
    categoryId: data.categoryId,
    name: data.name,
    description: data.description || null,
    longDescription: data.longDescription || null,
    price: data.price,
    imageUrl: data.imageUrl || null,
    tags: data.tags,
    spiceLevel: data.spiceLevel,
    calories: data.calories ?? null,
    prepMinutes: data.prepMinutes ?? null,
    isAvailable: data.isAvailable,
    isFeatured: data.isFeatured,
    sortOrder: data.sortOrder,
    updatedAt: new Date(),
  };

  let itemId = data.id;

  if (itemId) {
    await db.update(menuItems).set(values).where(eq(menuItems.id, itemId));
  } else {
    const [created] = await db
      .insert(menuItems)
      .values(values)
      .returning({ id: menuItems.id });
    itemId = created.id;
  }

  // Options are replaced wholesale — simpler and less error-prone than
  // diffing, and the lists are tiny.
  await db.delete(menuItemOptions).where(eq(menuItemOptions.itemId, itemId));

  if (data.options.length) {
    await db.insert(menuItemOptions).values(
      data.options.map((option, index) => ({
        itemId: itemId!,
        groupName: option.groupName,
        label: option.label,
        priceDelta: option.priceDelta || "0",
        isDefault: option.isDefault,
        sortOrder: index,
      })),
    );
  }

  await refreshMenu();
  return { ok: true };
}

/** Quick toggle from the list — the "we're out of that" button. */
export async function setItemAvailability(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(menuItems)
    .set({ isAvailable, updatedAt: new Date() })
    .where(eq(menuItems.id, id));

  await refreshMenu();
  return { ok: true };
}

/**
 * Removing an item archives it rather than deleting it, so past orders,
 * customer history and popularity stats stay intact.
 */
export async function archiveMenuItem(id: string): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(menuItems)
    .set({ isArchived: true, isAvailable: false, updatedAt: new Date() })
    .where(eq(menuItems.id, id));

  await refreshMenu();
  return { ok: true };
}

export async function restoreMenuItem(id: string): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(menuItems)
    .set({ isArchived: false, isAvailable: true, updatedAt: new Date() })
    .where(eq(menuItems.id, id));

  await refreshMenu();
  return { ok: true };
}

/* ---------------------------------------------------------------- tables */

const tableSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(40),
  seats: z.number().int().min(1).max(50).nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function saveTable(
  input: z.input<typeof tableSchema>,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the table details." };

  const { id, label, seats, isActive } = parsed.data;

  if (id) {
    await db
      .update(diningTables)
      .set({ label, seats: seats ?? null, isActive })
      .where(eq(diningTables.id, id));
  } else {
    const base = slugify(label) || "table";
    await db.insert(diningTables).values({
      label,
      qrSlug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      seats: seats ?? null,
      isActive,
    });
  }

  revalidatePath("/admin/tables");
  return { ok: true };
}

export async function deleteTable(id: string): Promise<ActionResult> {
  await requireAdmin();

  // orders.tableId is ON DELETE SET NULL, and the label is snapshotted on the
  // order, so history survives losing the table.
  await db.delete(diningTables).where(eq(diningTables.id, id));

  revalidatePath("/admin/tables");
  return { ok: true };
}
