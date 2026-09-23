/**
 * Shared shapes for the client bundle.
 *
 * These are deliberately plain and serializable: the same objects are cached
 * in IndexedDB, so they must survive `structuredClone` and never carry Dates
 * or class instances. Money is a decimal string end to end (see lib/money.ts).
 */

export type AppMode = "DISPLAY" | "ORDERING";

export type OrderStatus =
  | "PLACED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

export type OrderSource = "CUSTOMER" | "STAFF";

export interface PublicSettings {
  restaurantName: string;
  tagline: string | null;
  mode: AppMode;
  currency: string;
  taxRate: string;
  serviceChargeRate: string;
  menuVersion: number;
  acceptingOrders: boolean;
}

export interface MenuOption {
  id: string;
  groupName: string;
  label: string;
  priceDelta: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  price: string;
  imageUrl: string | null;
  tags: string[];
  spiceLevel: number;
  calories: number | null;
  prepMinutes: number | null;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  options: MenuOption[];
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

/** The entire customer-facing payload, cached wholesale in IndexedDB. */
export interface MenuSnapshot {
  version: number;
  settings: PublicSettings;
  categories: MenuCategory[];
  items: MenuItem[];
  /** Epoch ms when this snapshot was fetched, for the "last synced" label. */
  fetchedAt: number;
}

/** A chosen option, flattened for storage in the cart and on the order. */
export interface SelectedOption {
  groupName: string;
  label: string;
  priceDelta: string;
}

export interface CartLine {
  /** Stable per-line id: same item with different options is a separate line. */
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: string;
  imageUrl: string | null;
  qty: number;
  selectedOptions: SelectedOption[];
  note?: string;
}

export interface OrderTotals {
  subtotal: string;
  tax: string;
  serviceCharge: string;
  total: string;
}

/** What the client POSTs to /api/orders. `clientId` makes it idempotent. */
export interface OrderDraft {
  clientId: string;
  deviceId: string;
  tableSlug: string | null;
  note: string | null;
  lines: {
    itemId: string;
    qty: number;
    selectedOptions: SelectedOption[];
    note?: string;
  }[];
}

export interface OrderLineView {
  id: string;
  itemId: string | null;
  name: string;
  unitPrice: string;
  qty: number;
  selectedOptions: SelectedOption[];
  lineTotal: string;
  note: string | null;
}

export interface OrderView {
  id: string;
  clientId: string;
  publicCode: string;
  status: OrderStatus;
  source: OrderSource;
  tableLabel: string | null;
  subtotal: string;
  tax: string;
  serviceCharge: string;
  total: string;
  note: string | null;
  placedAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  lines: OrderLineView[];
}

/** One row of the customer's "you order this a lot" list. */
export interface HistoryStat {
  itemId: string;
  name: string;
  imageUrl: string | null;
  timesOrdered: number;
  unitsOrdered: number;
  lastOrderedAt: string;
  isFavorite: boolean;
  /** False when the item has since been archived or made unavailable. */
  stillOnMenu: boolean;
}

/**
 * A queued write made while offline. Drained in order by lib/sync.ts.
 * Every kind carries a client-generated id so replay is safe.
 */
export type OutboxEntry =
  | {
      kind: "order";
      id: string;
      createdAt: number;
      attempts: number;
      payload: OrderDraft;
    }
  | {
      kind: "favorite";
      id: string;
      createdAt: number;
      attempts: number;
      payload: { deviceId: string; itemId: string; favorite: boolean };
    };
