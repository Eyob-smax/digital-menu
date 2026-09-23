import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/* ------------------------------------------------------------------ enums */

export const appModeEnum = pgEnum("app_mode", ["DISPLAY", "ORDERING"]);

export const orderStatusEnum = pgEnum("order_status", [
  "PLACED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
]);

export const orderSourceEnum = pgEnum("order_source", ["CUSTOMER", "STAFF"]);

/* --------------------------------------------------------------- settings */

/**
 * Exactly one row, id = 1. `menuVersion` is bumped by every admin menu
 * mutation so an offline client can ask "did anything change?" cheaply
 * instead of re-downloading the whole menu.
 */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  restaurantName: varchar("restaurant_name", { length: 120 })
    .notNull()
    .default("My Restaurant"),
  tagline: varchar("tagline", { length: 200 }),
  mode: appModeEnum("mode").notNull().default("DISPLAY"),
  currency: varchar("currency", { length: 8 }).notNull().default("ETB"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0"),
  serviceChargeRate: numeric("service_charge_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0"),
  menuVersion: integer("menu_version").notNull().default(1),
  /** Kill switch for ORDERING mode, e.g. kitchen is slammed. */
  acceptingOrders: boolean("accepting_orders").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------- categories */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

/* ------------------------------------------------------------- menu items */

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 140 }).notNull(),
    /** Short line under the name on a menu card. */
    description: text("description"),
    /** Long copy for the item detail sheet: ingredients, story, pairing. */
    longDescription: text("long_description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** 0 = none, 3 = very spicy. Rendered as pepper glyphs. */
    spiceLevel: integer("spice_level").notNull().default(0),
    calories: integer("calories"),
    prepMinutes: integer("prep_minutes"),
    isAvailable: boolean("is_available").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /**
     * Soft delete. "Remove from menu" archives rather than deletes, so past
     * orders, history and popularity stats stay intact.
     */
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("menu_items_category_idx").on(t.categoryId),
    index("menu_items_visible_idx").on(t.isArchived, t.isAvailable),
  ],
);

/* ----------------------------------------------------------- item options */

/**
 * Choice groups per item, e.g. groupName "Size" with labels Small / Large.
 * `priceDelta` is added to the base price when selected.
 */
export const menuItemOptions = pgTable(
  "menu_item_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    groupName: varchar("group_name", { length: 60 }).notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    priceDelta: numeric("price_delta", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("menu_item_options_item_idx").on(t.itemId)],
);

/* --------------------------------------------------------- dining tables */

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: varchar("label", { length: 40 }).notNull(),
    /** Used in the QR URL /t/<qrSlug>. */
    qrSlug: varchar("qr_slug", { length: 40 }).notNull(),
    seats: integer("seats"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("dining_tables_qr_slug_idx").on(t.qrSlug)],
);

/* ------------------------------------------------------------------ orders */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Client-generated UUID, unique. This is what makes order submission
     * idempotent: an order queued offline can be retried any number of
     * times and will never create a duplicate row.
     */
    clientId: uuid("client_id").notNull(),
    /** Short human-readable code shown to customer and staff, e.g. "A7F2". */
    publicCode: varchar("public_code", { length: 8 }).notNull(),
    tableId: uuid("table_id").references(() => diningTables.id, {
      onDelete: "set null",
    }),
    /** Snapshot: the table may be renamed or removed later. */
    tableLabel: varchar("table_label", { length: 40 }),
    deviceId: varchar("device_id", { length: 64 }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("PLACED"),
    source: orderSourceEnum("source").notNull().default("CUSTOMER"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
    serviceCharge: numeric("service_charge", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    note: text("note"),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_client_id_idx").on(t.clientId),
    index("orders_status_placed_idx").on(t.status, t.placedAt),
    index("orders_device_idx").on(t.deviceId, t.placedAt),
    index("orders_user_idx").on(t.userId, t.placedAt),
  ],
);

/* ------------------------------------------------------------- order items */

/**
 * `nameSnapshot` / `priceSnapshot` freeze what the customer actually bought,
 * so their history still reads correctly a year later even if the item was
 * renamed, repriced or archived. `itemId` is kept alongside for popularity
 * stats, favorites and "order this again".
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => menuItems.id, {
      onDelete: "set null",
    }),
    nameSnapshot: varchar("name_snapshot", { length: 140 }).notNull(),
    priceSnapshot: numeric("price_snapshot", {
      precision: 10,
      scale: 2,
    }).notNull(),
    qty: integer("qty").notNull().default(1),
    selectedOptions: jsonb("selected_options")
      .$type<{ groupName: string; label: string; priceDelta: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
    note: text("note"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_item_idx").on(t.itemId),
  ],
);

/* --------------------------------------------------------------- favorites */

/**
 * Keyed by device first, since customers have no account by default. When a
 * device is later linked to an account, `userId` is backfilled so favorites
 * follow the person onto another phone.
 */
export const favorites = pgTable(
  "favorites",
  {
    deviceId: varchar("device_id", { length: 64 }).notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.deviceId, t.itemId] }),
    index("favorites_item_idx").on(t.itemId),
    index("favorites_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------- item stats */

/**
 * Denormalized popularity counters. Incremented when an order reaches SERVED,
 * so cancelled orders never inflate them. Keeps the admin dashboard a single
 * cheap read instead of an aggregate over every order ever placed.
 */
export const itemStats = pgTable("item_stats", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  orderCount: integer("order_count").notNull().default(0),
  unitsSold: integer("units_sold").notNull().default(0),
  lastOrderedAt: timestamp("last_ordered_at", { withTimezone: true }),
});

/* ------------------------------------------------------------ device links */

/** Maps an anonymous device to an account once the customer claims it. */
export const deviceLinks = pgTable(
  "device_links",
  {
    deviceId: varchar("device_id", { length: 64 }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("device_links_user_idx").on(t.userId)],
);

/* --------------------------------------------------------------- relations */

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  options: many(menuItemOptions),
  stats: one(itemStats, {
    fields: [menuItems.id],
    references: [itemStats.itemId],
  }),
}));

export const menuItemOptionsRelations = relations(
  menuItemOptions,
  ({ one }) => ({
    item: one(menuItems, {
      fields: [menuItemOptions.itemId],
      references: [menuItems.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  items: many(orderItems),
  table: one(diningTables, {
    fields: [orders.tableId],
    references: [diningTables.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  item: one(menuItems, {
    fields: [orderItems.itemId],
    references: [menuItems.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  item: one(menuItems, {
    fields: [favorites.itemId],
    references: [menuItems.id],
  }),
}));

export const itemStatsRelations = relations(itemStats, ({ one }) => ({
  item: one(menuItems, {
    fields: [itemStats.itemId],
    references: [menuItems.id],
  }),
}));
