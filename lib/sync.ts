"use client";

import {
  bumpAttempts,
  cacheFavorites,
  cacheHistory,
  cacheMenu,
  dequeue,
  getCachedMenu,
  getOutbox,
} from "./offline-store";
import type { MenuSnapshot, OrderView, OutboxEntry } from "./types";

/**
 * Talking to the server, and surviving not being able to.
 *
 * Two jobs:
 *   1. Pull  — refresh the menu, favorites and history into IndexedDB.
 *   2. Push  — drain writes queued while offline.
 *
 * Both are safe to call at any time, including with no network. Nothing here
 * throws on a failed fetch; callers get a result object instead, because an
 * offline customer is a normal state in this app, not an error.
 */

/** Give up on an entry after this many failed attempts. */
const MAX_ATTEMPTS = 8;

export interface PullResult {
  ok: boolean;
  snapshot: MenuSnapshot | null;
  /** True when the server confirmed our cached version is still current. */
  unchanged: boolean;
}

async function safeFetch(
  input: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(input, { ...init, cache: "no-store" });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ pull */

/**
 * Fetches the menu, sending the cached version so the server can answer
 * "nothing changed" without shipping the whole payload again.
 */
export async function pullMenu(): Promise<PullResult> {
  const cached = await getCachedMenu();
  const since = cached?.version ?? 0;

  const response = await safeFetch(`/api/menu?since=${since}`);
  if (!response || !response.ok) {
    return { ok: false, snapshot: cached, unchanged: false };
  }

  const body = (await response.json()) as
    | { unchanged: true }
    | (Omit<MenuSnapshot, "fetchedAt"> & { unchanged?: false });

  if ("unchanged" in body && body.unchanged) {
    // Still refresh the timestamp so the UI can say "synced just now".
    if (cached) {
      const touched = { ...cached, fetchedAt: Date.now() };
      await cacheMenu(touched);
      return { ok: true, snapshot: touched, unchanged: true };
    }
    return { ok: true, snapshot: null, unchanged: true };
  }

  const snapshot: MenuSnapshot = {
    version: body.version,
    settings: body.settings,
    categories: body.categories,
    items: body.items,
    fetchedAt: Date.now(),
  };

  await cacheMenu(snapshot);
  return { ok: true, snapshot, unchanged: false };
}

export async function pullFavorites(deviceId: string): Promise<string[] | null> {
  const response = await safeFetch(
    `/api/favorites?deviceId=${encodeURIComponent(deviceId)}`,
  );
  if (!response || !response.ok) return null;

  const body = (await response.json()) as { itemIds: string[] };
  await cacheFavorites(body.itemIds);
  return body.itemIds;
}

export async function pullHistory(
  deviceId: string,
): Promise<OrderView[] | null> {
  const response = await safeFetch(
    `/api/history?deviceId=${encodeURIComponent(deviceId)}`,
  );
  if (!response || !response.ok) return null;

  const body = (await response.json()) as { orders: OrderView[] };
  await cacheHistory(body.orders);
  return body.orders;
}

/* ------------------------------------------------------------------ push */

/**
 * Sends one queued entry. Returns "done" when the server has it (or has
 * permanently rejected it), "retry" when the failure looks transient.
 *
 * A 4xx is treated as permanent: replaying a request the server called
 * invalid will never start working, and a stuck queue blocks everything
 * behind it.
 */
async function pushEntry(entry: OutboxEntry): Promise<"done" | "retry"> {
  if (entry.kind === "order") {
    const response = await safeFetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry.payload),
    });

    if (!response) return "retry";
    if (response.ok || response.status === 409) return "done";
    return response.status >= 400 && response.status < 500 ? "done" : "retry";
  }

  const { deviceId, itemId, favorite } = entry.payload;
  const response = await safeFetch("/api/favorites", {
    method: favorite ? "POST" : "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId, itemId }),
  });

  if (!response) return "retry";
  if (response.ok) return "done";
  return response.status >= 400 && response.status < 500 ? "done" : "retry";
}

export interface FlushResult {
  sent: number;
  remaining: number;
}

let flushing = false;

/**
 * Drains the outbox oldest-first. Serial on purpose: two orders from one
 * table should reach the kitchen in the order the customer made them.
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { sent: 0, remaining: (await getOutbox()).length };
  flushing = true;

  try {
    const queue = await getOutbox();
    const settled: string[] = [];

    for (const entry of queue) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        settled.push(entry.id);
        continue;
      }

      const outcome = await pushEntry(entry);
      if (outcome === "done") {
        settled.push(entry.id);
      } else {
        await bumpAttempts(entry.id);
        // Stop at the first transient failure: the network is down, so the
        // rest will fail too, and order matters.
        break;
      }
    }

    if (settled.length) await dequeue(settled);

    return {
      sent: settled.length,
      remaining: (await getOutbox()).length,
    };
  } finally {
    flushing = false;
  }
}

/* ---------------------------------------------------------- full refresh */

/**
 * Push first, then pull: sending a queued order before re-reading history
 * means the customer sees their own order reflected in the result.
 */
export async function syncAll(deviceId: string): Promise<{
  menu: MenuSnapshot | null;
  online: boolean;
}> {
  await flushOutbox();

  const menu = await pullMenu();
  if (menu.ok && deviceId) {
    await Promise.all([pullFavorites(deviceId), pullHistory(deviceId)]);
  }

  return { menu: menu.snapshot, online: menu.ok };
}
