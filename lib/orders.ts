import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  diningTables,
  itemStats,
  menuItemOptions,
  menuItems,
  orderItems,
  orders,
} from "@/db/schema";

import { computeTotals, unitPriceWithOptions } from "./money";
import { getPublicSettings } from "./queries";
import type { OrderDraft, OrderStatus, SelectedOption } from "./types";

/**
 * Placing and advancing orders.
 *
 * Two rules govern this file:
 *
 * 1. **The server prices the order, never the client.** The incoming draft
 *    carries item ids and quantities only. Prices are re-read from the
 *    database, so a tampered payload — or a stale offline cart priced against
 *    last week's menu — cannot change what the customer is charged.
 *
 * 2. **Submission is idempotent on `clientId`.** An order queued offline may
 *    be retried many times. The unique index on `orders.client_id` makes the
 *    duplicate a no-op that returns the original order.
 */

export type PlaceOrderResult =
  | { ok: true; orderId: string; publicCode: string; duplicate: boolean }
  | { ok: false; error: string; code: "EMPTY" | "UNAVAILABLE" | "CLOSED" };

/** Short, unambiguous code for staff to call out. No 0/O/1/I confusion. */
function makePublicCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY2346789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function placeOrder(
  draft: OrderDraft,
  opts: { source?: "CUSTOMER" | "STAFF"; userId?: string | null } = {},
): Promise<PlaceOrderResult> {
  if (!draft.lines?.length) {
    return { ok: false, error: "Your cart is empty.", code: "EMPTY" };
  }

  // Idempotency: if this clientId already landed, return the original.
  const [existing] = await db
    .select({ id: orders.id, publicCode: orders.publicCode })
    .from(orders)
    .where(eq(orders.clientId, draft.clientId));

  if (existing) {
    return {
      ok: true,
      orderId: existing.id,
      publicCode: existing.publicCode,
      duplicate: true,
    };
  }

  const settings = await getPublicSettings();

  if (settings.mode !== "ORDERING" || !settings.acceptingOrders) {
    return {
      ok: false,
      error: "The restaurant is not taking app orders right now.",
      code: "CLOSED",
    };
  }

  /* ---------------------------------------------- price from the database */

  const itemIds = Array.from(new Set(draft.lines.map((l) => l.itemId)));

  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      price: menuItems.price,
      isAvailable: menuItems.isAvailable,
      isArchived: menuItems.isArchived,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, itemIds));

  const itemById = new Map(rows.map((r) => [r.id, r]));

  const unavailable = itemIds.filter((id) => {
    const item = itemById.get(id);
    return !item || item.isArchived || !item.isAvailable;
  });

  if (unavailable.length) {
    const names = unavailable
      .map((id) => itemById.get(id)?.name)
      .filter(Boolean);
    return {
      ok: false,
      code: "UNAVAILABLE",
      error: names.length
        ? `No longer available: ${names.join(", ")}.`
        : "Some items are no longer on the menu.",
    };
  }

  // Option prices also come from the database. The client sends labels; we
  // resolve them against the real option rows and ignore anything invented.
  const optionRows = await db
    .select()
    .from(menuItemOptions)
    .where(inArray(menuItemOptions.itemId, itemIds));

  const optionKey = (itemId: string, group: string, label: string) =>
    `${itemId}::${group}::${label}`;

  const optionByKey = new Map(
    optionRows.map((o) => [optionKey(o.itemId, o.groupName, o.label), o]),
  );

  const priced = draft.lines.map((line) => {
    const item = itemById.get(line.itemId)!;
    const qty = Math.max(1, Math.min(99, Math.floor(line.qty) || 1));

    const resolvedOptions: SelectedOption[] = (line.selectedOptions ?? [])
      .map((selected) =>
        optionByKey.get(
          optionKey(line.itemId, selected.groupName, selected.label),
        ),
      )
      .filter((o): o is (typeof optionRows)[number] => Boolean(o))
      .map((o) => ({
        groupName: o.groupName,
        label: o.label,
        priceDelta: o.priceDelta,
      }));

    const unitPrice = unitPriceWithOptions(item.price, resolvedOptions);

    return {
      itemId: item.id,
      name: item.name,
      unitPrice,
      qty,
      selectedOptions: resolvedOptions,
      note: line.note?.slice(0, 200) ?? null,
    };
  });

  const totals = computeTotals(
    priced.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
    settings.taxRate,
    settings.serviceChargeRate,
  );

  /* --------------------------------------------------------- resolve table */

  let tableId: string | null = null;
  let tableLabel: string | null = null;

  if (draft.tableSlug) {
    const [table] = await db
      .select({ id: diningTables.id, label: diningTables.label })
      .from(diningTables)
      .where(eq(diningTables.qrSlug, draft.tableSlug));

    if (table) {
      tableId = table.id;
      tableLabel = table.label;
    }
  }

  /* ------------------------------------------------------------- persist */

  const publicCode = makePublicCode();

  const [order] = await db
    .insert(orders)
    .values({
      clientId: draft.clientId,
      publicCode,
      tableId,
      tableLabel,
      deviceId: draft.deviceId || null,
      userId: opts.userId ?? null,
      status: "PLACED",
      source: opts.source ?? "CUSTOMER",
      subtotal: totals.subtotal,
      tax: totals.tax,
      serviceCharge: totals.serviceCharge,
      total: totals.total,
      note: draft.note?.slice(0, 500) || null,
    })
    // A concurrent retry of the same queued order loses this race; we then
    // read back the winner below rather than erroring.
    .onConflictDoNothing({ target: orders.clientId })
    .returning({ id: orders.id, publicCode: orders.publicCode });

  if (!order) {
    const [winner] = await db
      .select({ id: orders.id, publicCode: orders.publicCode })
      .from(orders)
      .where(eq(orders.clientId, draft.clientId));

    return winner
      ? {
          ok: true,
          orderId: winner.id,
          publicCode: winner.publicCode,
          duplicate: true,
        }
      : { ok: false, error: "Could not save the order.", code: "EMPTY" };
  }

  await db.insert(orderItems).values(
    priced.map((line) => ({
      orderId: order.id,
      itemId: line.itemId,
      nameSnapshot: line.name,
      priceSnapshot: line.unitPrice,
      qty: line.qty,
      selectedOptions: line.selectedOptions,
      lineTotal: computeTotals([line], "0", "0").subtotal,
      note: line.note,
    })),
  );

  return {
    ok: true,
    orderId: order.id,
    publicCode: order.publicCode,
    duplicate: false,
  };
}

/* ----------------------------------------------------- status transitions */

const TIMESTAMP_FOR: Partial<Record<OrderStatus, keyof typeof orders>> = {
  PREPARING: "acceptedAt",
  READY: "readyAt",
  SERVED: "servedAt",
  CANCELLED: "cancelledAt",
};

/** Which moves are legal. Prevents a stray tap resurrecting a served order. */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  const [current] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId));

  if (!current) return { ok: false, error: "Order not found." };
  if (current.status === next) return { ok: true };

  if (!ALLOWED[current.status].includes(next)) {
    return {
      ok: false,
      error: `Cannot move an order from ${current.status} to ${next}.`,
    };
  }

  const stampColumn = TIMESTAMP_FOR[next];

  await db
    .update(orders)
    .set({
      status: next,
      ...(stampColumn ? { [stampColumn]: new Date() } : {}),
    })
    .where(eq(orders.id, orderId));

  // Popularity counts only what actually reached the table, so a cancelled
  // order never inflates the admin's "most ordered" list.
  if (next === "SERVED") {
    await incrementStatsForOrder(orderId);
  }

  return { ok: true };
}

async function incrementStatsForOrder(orderId: string): Promise<void> {
  const lines = await db
    .select({ itemId: orderItems.itemId, qty: orderItems.qty })
    .from(orderItems)
    .where(
      and(eq(orderItems.orderId, orderId), sql`${orderItems.itemId} is not null`),
    );

  if (!lines.length) return;

  // Merge duplicate lines of the same item first: one row per item means one
  // upsert per item, and "times ordered" counts orders, not lines.
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.itemId) continue;
    totals.set(line.itemId, (totals.get(line.itemId) ?? 0) + line.qty);
  }

  const now = new Date();

  await Promise.all(
    Array.from(totals.entries()).map(([itemId, qty]) =>
      db
        .insert(itemStats)
        .values({
          itemId,
          orderCount: 1,
          unitsSold: qty,
          lastOrderedAt: now,
        })
        .onConflictDoUpdate({
          target: itemStats.itemId,
          set: {
            orderCount: sql`${itemStats.orderCount} + 1`,
            unitsSold: sql`${itemStats.unitsSold} + ${qty}`,
            lastOrderedAt: now,
          },
        }),
    ),
  );
}
