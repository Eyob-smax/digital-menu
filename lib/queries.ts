import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  diningTables,
  favorites,
  itemStats,
  menuItemOptions,
  menuItems,
  orderItems,
  orders,
  settings,
} from "@/db/schema";

import type {
  HistoryStat,
  MenuSnapshot,
  OrderView,
  PublicSettings,
} from "./types";

/**
 * Server-side reads. Everything the customer app, staff screen and admin
 * dashboard need, in one place so the shapes stay consistent with lib/types.
 */

/* -------------------------------------------------------------- settings */

/**
 * The single settings row, created on first read so a fresh database is
 * never a crash.
 */
export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;

  const [created] = await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [existing] = await db.select().from(settings).where(eq(settings.id, 1));
  return existing;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const row = await getSettings();
  return {
    restaurantName: row.restaurantName,
    tagline: row.tagline,
    mode: row.mode,
    currency: row.currency,
    taxRate: row.taxRate,
    serviceChargeRate: row.serviceChargeRate,
    menuVersion: row.menuVersion,
    acceptingOrders: row.acceptingOrders,
  };
}

/** Bumped by every menu mutation; offline clients compare against it. */
export async function bumpMenuVersion(): Promise<number> {
  const [row] = await db
    .update(settings)
    .set({
      menuVersion: sql`${settings.menuVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1))
    .returning({ menuVersion: settings.menuVersion });

  return row?.menuVersion ?? 1;
}

/* ------------------------------------------------------------------ menu */

/**
 * The whole customer-facing menu in two queries. Small enough to send
 * wholesale (a restaurant menu is tens of items, not thousands), which is
 * what makes the offline cache simple: one snapshot, one version number.
 */
export async function getMenuSnapshot(): Promise<
  Omit<MenuSnapshot, "fetchedAt">
> {
  const publicSettings = await getPublicSettings();

  const [categoryRows, itemRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.sortOrder, categories.name),
    db
      .select()
      .from(menuItems)
      .where(eq(menuItems.isArchived, false))
      .orderBy(menuItems.sortOrder, menuItems.name),
  ]);

  /**
   * Sold-out items are included, flagged `isAvailable: false`, rather than
   * hidden. A dish that silently disappears gets asked for anyway; one shown
   * greyed out with "Sold out" answers the question before it's asked.
   * Archived items are the ones genuinely gone, and those are filtered above.
   */
  const visibleItems = itemRows;

  const itemIds = visibleItems.map((item) => item.id);
  const optionRows = itemIds.length
    ? await db
        .select()
        .from(menuItemOptions)
        .where(inArray(menuItemOptions.itemId, itemIds))
        .orderBy(menuItemOptions.groupName, menuItemOptions.sortOrder)
    : [];

  const optionsByItem = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const list = optionsByItem.get(option.itemId) ?? [];
    list.push(option);
    optionsByItem.set(option.itemId, list);
  }

  return {
    version: publicSettings.menuVersion,
    settings: publicSettings,
    categories: categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
    })),
    items: visibleItems.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      longDescription: item.longDescription,
      price: item.price,
      imageUrl: item.imageUrl,
      tags: item.tags,
      spiceLevel: item.spiceLevel,
      calories: item.calories,
      prepMinutes: item.prepMinutes,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      sortOrder: item.sortOrder,
      options: (optionsByItem.get(item.id) ?? []).map((o) => ({
        id: o.id,
        groupName: o.groupName,
        label: o.label,
        priceDelta: o.priceDelta,
        isDefault: o.isDefault,
        sortOrder: o.sortOrder,
      })),
    })),
  };
}

/* ------------------------------------------------------------- favorites */

export async function getFavoriteIds(
  deviceId: string,
  userId?: string | null,
): Promise<string[]> {
  if (!deviceId && !userId) return [];

  // A linked account's favorites follow the person onto any device, so match
  // on either identifier.
  const rows = await db
    .select({ itemId: favorites.itemId })
    .from(favorites)
    .where(
      userId
        ? sql`${favorites.deviceId} = ${deviceId} OR ${favorites.userId} = ${userId}`
        : eq(favorites.deviceId, deviceId),
    );

  return Array.from(new Set(rows.map((r) => r.itemId)));
}

/* --------------------------------------------------------------- orders */

const ORDER_COLUMNS = {
  id: orders.id,
  clientId: orders.clientId,
  publicCode: orders.publicCode,
  status: orders.status,
  source: orders.source,
  tableLabel: orders.tableLabel,
  subtotal: orders.subtotal,
  tax: orders.tax,
  serviceCharge: orders.serviceCharge,
  total: orders.total,
  note: orders.note,
  placedAt: orders.placedAt,
  acceptedAt: orders.acceptedAt,
  readyAt: orders.readyAt,
  servedAt: orders.servedAt,
};

/**
 * Derived from ORDER_COLUMNS so nullability always tracks the schema —
 * writing this shape out by hand silently drops the `| null`s.
 */
type OrderRow = {
  [K in keyof typeof ORDER_COLUMNS]: (typeof ORDER_COLUMNS)[K] extends {
    _: { notNull: true; data: infer D };
  }
    ? D
    : (typeof ORDER_COLUMNS)[K]["_"]["data"] | null;
};

/** Attaches line items to order rows in one extra query, never N+1. */
async function withLines(rows: OrderRow[]): Promise<OrderView[]> {
  if (!rows.length) return [];

  const lineRows = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    );

  const linesByOrder = new Map<string, OrderView["lines"]>();
  for (const line of lineRows) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push({
      id: line.id,
      itemId: line.itemId,
      name: line.nameSnapshot,
      unitPrice: line.priceSnapshot,
      qty: line.qty,
      selectedOptions: line.selectedOptions,
      lineTotal: line.lineTotal,
      note: line.note,
    });
    linesByOrder.set(line.orderId, list);
  }

  return rows.map((row) => ({
    ...row,
    placedAt: row.placedAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    servedAt: row.servedAt?.toISOString() ?? null,
    lines: linesByOrder.get(row.id) ?? [],
  }));
}

/** The staff queue: everything not yet served or cancelled. */
export async function getLiveOrders(): Promise<OrderView[]> {
  const rows = await db
    .select(ORDER_COLUMNS)
    .from(orders)
    .where(inArray(orders.status, ["PLACED", "PREPARING", "READY"]))
    .orderBy(orders.placedAt);

  return withLines(rows);
}

export async function getOrdersForDevice(
  deviceId: string,
  userId?: string | null,
  limit = 40,
): Promise<OrderView[]> {
  if (!deviceId && !userId) return [];

  const rows = await db
    .select(ORDER_COLUMNS)
    .from(orders)
    .where(
      userId
        ? sql`${orders.deviceId} = ${deviceId} OR ${orders.userId} = ${userId}`
        : eq(orders.deviceId, deviceId),
    )
    .orderBy(desc(orders.placedAt))
    .limit(limit);

  return withLines(rows);
}

/**
 * "You order this a lot" — per-item counts for one customer, which is the
 * personal counterpart to the admin's global popularity stats.
 */
export async function getPersonalStats(
  deviceId: string,
  userId?: string | null,
): Promise<HistoryStat[]> {
  if (!deviceId && !userId) return [];

  const rows = await db
    .select({
      itemId: orderItems.itemId,
      name: sql<string>`max(${orderItems.nameSnapshot})`,
      timesOrdered: sql<number>`count(distinct ${orders.id})::int`,
      unitsOrdered: sql<number>`sum(${orderItems.qty})::int`,
      lastOrderedAt: sql<Date>`max(${orders.placedAt})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        sql`${orderItems.itemId} is not null`,
        sql`${orders.status} <> 'CANCELLED'`,
        userId
          ? sql`(${orders.deviceId} = ${deviceId} OR ${orders.userId} = ${userId})`
          : eq(orders.deviceId, deviceId),
      ),
    )
    .groupBy(orderItems.itemId)
    .orderBy(sql`count(distinct ${orders.id}) desc`);

  if (!rows.length) return [];

  const ids = rows.map((r) => r.itemId!).filter(Boolean);

  const [liveItems, favoriteIds] = await Promise.all([
    ids.length
      ? db
          .select({
            id: menuItems.id,
            imageUrl: menuItems.imageUrl,
            isAvailable: menuItems.isAvailable,
            isArchived: menuItems.isArchived,
          })
          .from(menuItems)
          .where(inArray(menuItems.id, ids))
      : Promise.resolve([]),
    getFavoriteIds(deviceId, userId),
  ]);

  const liveById = new Map(liveItems.map((i) => [i.id, i]));
  const favoriteSet = new Set(favoriteIds);

  return rows.map((row) => {
    const live = row.itemId ? liveById.get(row.itemId) : undefined;
    return {
      itemId: row.itemId!,
      name: row.name,
      imageUrl: live?.imageUrl ?? null,
      timesOrdered: row.timesOrdered,
      unitsOrdered: row.unitsOrdered,
      lastOrderedAt: new Date(row.lastOrderedAt).toISOString(),
      isFavorite: row.itemId ? favoriteSet.has(row.itemId) : false,
      stillOnMenu: Boolean(live && !live.isArchived && live.isAvailable),
    };
  });
}

/* ----------------------------------------------------------------- admin */

/** Global popularity, for the admin dashboard. */
export async function getItemPopularity(limit = 100) {
  return db
    .select({
      itemId: menuItems.id,
      name: menuItems.name,
      imageUrl: menuItems.imageUrl,
      price: menuItems.price,
      isAvailable: menuItems.isAvailable,
      isArchived: menuItems.isArchived,
      orderCount: sql<number>`coalesce(${itemStats.orderCount}, 0)::int`,
      unitsSold: sql<number>`coalesce(${itemStats.unitsSold}, 0)::int`,
      lastOrderedAt: itemStats.lastOrderedAt,
    })
    .from(menuItems)
    .leftJoin(itemStats, eq(itemStats.itemId, menuItems.id))
    .where(eq(menuItems.isArchived, false))
    .orderBy(sql`coalesce(${itemStats.unitsSold}, 0) desc`, menuItems.name)
    .limit(limit);
}

export async function getTables() {
  return db.select().from(diningTables).orderBy(diningTables.label);
}

export async function getTableBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(diningTables)
    .where(and(eq(diningTables.qrSlug, slug), eq(diningTables.isActive, true)));
  return row ?? null;
}

export async function getAdminCategories() {
  return db
    .select()
    .from(categories)
    .orderBy(categories.sortOrder, categories.name);
}

/* ------------------------------------------------------------- dashboard */

/**
 * Headline numbers for the admin dashboard. `since` is a JS Date so the
 * caller controls the window — "today" is the restaurant's business day, not
 * necessarily UTC midnight.
 */
export async function getDashboardStats(since: Date) {
  const [totals] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(case when ${orders.status} <> 'CANCELLED' then ${orders.total} else 0 end), 0)::text`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'CANCELLED')::int`,
      open: sql<number>`count(*) filter (where ${orders.status} in ('PLACED','PREPARING','READY'))::int`,
    })
    .from(orders)
    .where(sql`${orders.placedAt} >= ${since.toISOString()}`);

  const [inventory] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unavailable: sql<number>`count(*) filter (where ${menuItems.isAvailable} = false)::int`,
    })
    .from(menuItems)
    .where(eq(menuItems.isArchived, false));

  return {
    orderCount: totals?.orderCount ?? 0,
    revenue: totals?.revenue ?? "0",
    cancelled: totals?.cancelled ?? 0,
    open: totals?.open ?? 0,
    itemCount: inventory?.total ?? 0,
    unavailableCount: inventory?.unavailable ?? 0,
  };
}

/**
 * Per-item order counts over a window, for the analytics screen. Computed
 * from order rows rather than the denormalized counters so it can be sliced
 * by date.
 */
export async function getItemFrequency(since: Date, limit = 50) {
  return db
    .select({
      itemId: orderItems.itemId,
      name: sql<string>`max(${orderItems.nameSnapshot})`,
      timesOrdered: sql<number>`count(distinct ${orders.id})::int`,
      unitsSold: sql<number>`sum(${orderItems.qty})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)::text`,
      lastOrderedAt: sql<Date>`max(${orders.placedAt})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        sql`${orders.placedAt} >= ${since.toISOString()}`,
        sql`${orders.status} <> 'CANCELLED'`,
      ),
    )
    .groupBy(orderItems.itemId)
    .orderBy(sql`sum(${orderItems.qty}) desc`)
    .limit(limit);
}

/** Recent orders for the dashboard's activity list. */
export async function getRecentOrders(limit = 8): Promise<OrderView[]> {
  const rows = await db
    .select(ORDER_COLUMNS)
    .from(orders)
    .orderBy(desc(orders.placedAt))
    .limit(limit);

  return withLines(rows);
}
