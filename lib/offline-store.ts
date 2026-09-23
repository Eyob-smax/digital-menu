"use client";

import { createStore, del, get, set } from "idb-keyval";

import type { MenuSnapshot, OrderView, OutboxEntry } from "./types";

/**
 * The offline brain of the customer app.
 *
 * Everything the customer needs to browse lives in IndexedDB: the menu, their
 * favorites, their history, and a queue of writes they made with no signal.
 * The UI reads from here first and treats the network as an upgrade, which is
 * why the app opens instantly and keeps working in a basement dining room.
 *
 * localStorage is used only for the device id, because it must be readable
 * synchronously during the first render before IndexedDB has opened.
 */

const store =
  typeof indexedDB !== "undefined"
    ? createStore("digital-menu", "kv")
    : undefined;

const KEY = {
  menu: "menu-snapshot",
  favorites: "favorites",
  history: "order-history",
  outbox: "outbox",
  table: "table-slug",
  cart: "cart",
} as const;

const DEVICE_ID_KEY = "dm-device-id";

/* ------------------------------------------------------------- device id */

/**
 * Stable anonymous identity. Created on first visit and never sent anywhere
 * except this app's own API. Synchronous by design so the first render can
 * use it.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    // Private mode with storage blocked: fall back to a per-session id so the
    // app still works, accepting that history won't survive a reload.
    return `ephemeral-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------- generic helpers */

/**
 * Every read is wrapped: a browser with IndexedDB disabled, a full disk, or a
 * private window should degrade to "no cache", never to a crashed app.
 */
async function read<T>(key: string, fallback: T): Promise<T> {
  if (!store) return fallback;
  try {
    const value = await get<T>(key, store);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  if (!store) return;
  try {
    await set(key, value, store);
  } catch {
    // Quota exceeded or storage blocked. The in-memory UI state is still
    // correct for this session; the next sync will re-populate the cache.
  }
}

async function remove(key: string): Promise<void> {
  if (!store) return;
  try {
    await del(key, store);
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------- menu cache */

export function getCachedMenu(): Promise<MenuSnapshot | null> {
  return read<MenuSnapshot | null>(KEY.menu, null);
}

export function cacheMenu(snapshot: MenuSnapshot): Promise<void> {
  return write(KEY.menu, snapshot);
}

/* ------------------------------------------------------------ favorites */

/**
 * Favorites are mirrored locally so the heart icon responds instantly and
 * stays correct offline. The server copy is authoritative once online.
 */
export function getCachedFavorites(): Promise<string[]> {
  return read<string[]>(KEY.favorites, []);
}

export function cacheFavorites(itemIds: string[]): Promise<void> {
  return write(KEY.favorites, Array.from(new Set(itemIds)));
}

export async function toggleCachedFavorite(
  itemId: string,
  favorite: boolean,
): Promise<string[]> {
  const current = await getCachedFavorites();
  const next = favorite
    ? Array.from(new Set([...current, itemId]))
    : current.filter((id) => id !== itemId);
  await cacheFavorites(next);
  return next;
}

/* -------------------------------------------------------------- history */

export function getCachedHistory(): Promise<OrderView[]> {
  return read<OrderView[]>(KEY.history, []);
}

export function cacheHistory(orders: OrderView[]): Promise<void> {
  return write(KEY.history, orders);
}

/**
 * Records an order the moment it is placed, before the server has confirmed
 * it, so the customer sees it in their history even if they are offline.
 */
export async function prependHistory(order: OrderView): Promise<OrderView[]> {
  const current = await getCachedHistory();
  const next = [order, ...current.filter((o) => o.clientId !== order.clientId)];
  await cacheHistory(next.slice(0, 100));
  return next;
}

/* ------------------------------------------------------------- the cart */

export function getCachedCart<T>(): Promise<T[]> {
  return read<T[]>(KEY.cart, []);
}

export function cacheCart<T>(lines: T[]): Promise<void> {
  return write(KEY.cart, lines);
}

export function clearCart(): Promise<void> {
  return remove(KEY.cart);
}

/* ------------------------------------------------------------ table tag */

/** Which table this phone scanned into, remembered for the visit. */
export function getTableSlug(): Promise<string | null> {
  return read<string | null>(KEY.table, null);
}

export function setTableSlug(slug: string | null): Promise<void> {
  return slug ? write(KEY.table, slug) : remove(KEY.table);
}

/* --------------------------------------------------------------- outbox */

/**
 * The queue of writes made offline. Ordered, append-only until drained.
 * Each entry keeps an `attempts` count so a permanently poisoned entry can be
 * dropped rather than retried forever.
 */
export function getOutbox(): Promise<OutboxEntry[]> {
  return read<OutboxEntry[]>(KEY.outbox, []);
}

export async function enqueue(entry: OutboxEntry): Promise<void> {
  const current = await getOutbox();
  // Replace any earlier entry with the same id so a re-queued favorite
  // toggle doesn't pile up duplicates.
  const next = [...current.filter((e) => e.id !== entry.id), entry];
  await write(KEY.outbox, next);
}

export async function dequeue(ids: string[]): Promise<void> {
  const current = await getOutbox();
  const gone = new Set(ids);
  await write(
    KEY.outbox,
    current.filter((e) => !gone.has(e.id)),
  );
}

export async function bumpAttempts(id: string): Promise<void> {
  const current = await getOutbox();
  await write(
    KEY.outbox,
    current.map((e) => (e.id === id ? { ...e, attempts: e.attempts + 1 } : e)),
  );
}

export async function clearAll(): Promise<void> {
  await Promise.all(Object.values(KEY).map(remove));
}
