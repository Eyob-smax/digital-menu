"use client";

import * as React from "react";

import {
  cacheCart,
  clearCart,
  enqueue,
  getCachedCart,
  getCachedFavorites,
  getCachedMenu,
  getDeviceId,
  getOutbox,
  getTableSlug,
  newId,
  prependHistory,
  setTableSlug as persistTableSlug,
  toggleCachedFavorite,
} from "@/lib/offline-store";
import { computeTotals, unitPriceWithOptions } from "@/lib/money";
import { flushOutbox, pullFavorites, pullHistory, pullMenu } from "@/lib/sync";
import type {
  CartLine,
  HistoryStat,
  MenuItem,
  MenuSnapshot,
  OrderView,
  SelectedOption,
} from "@/lib/types";
import { lineKey } from "@/lib/utils";

/**
 * One provider holds everything the customer app needs, because everything it
 * needs is small and deeply interrelated: the menu, favourites, history, the
 * cart, and whether any of it is currently reaching the server.
 *
 * The governing idea is **cache first, network second**. Every screen renders
 * from IndexedDB immediately, then quietly upgrades when the network answers.
 * Nothing waits on a spinner for data we already have.
 */

interface MenuContextValue {
  ready: boolean;
  online: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  pendingCount: number;

  deviceId: string;
  snapshot: MenuSnapshot | null;
  tableSlug: string | null;

  favorites: Set<string>;
  history: OrderView[];
  stats: HistoryStat[];

  cart: CartLine[];
  cartCount: number;
  cartTotals: ReturnType<typeof computeTotals>;

  setTable: (slug: string | null) => void;
  toggleFavorite: (itemId: string) => void;
  addToCart: (item: MenuItem, options: SelectedOption[], qty?: number) => void;
  setLineQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  emptyCart: () => void;
  submitOrder: (note?: string) => Promise<SubmitResult>;
  refresh: () => Promise<void>;
}

export type SubmitResult =
  | { status: "sent"; publicCode: string }
  | { status: "queued" }
  | { status: "error"; message: string };

const MenuContext = React.createContext<MenuContextValue | null>(null);

export function useMenu(): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used inside <MenuProvider>");
  }
  return context;
}

export function MenuProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  /**
   * Server-rendered menu for a first visit, so the app is never blank.
   * Arrives without `fetchedAt` — that timestamp is stamped on the client,
   * because taking `Date.now()` during render is impure and would disagree
   * between the server and the browser anyway.
   */
  initialSnapshot: Omit<MenuSnapshot, "fetchedAt"> | null;
}) {
  const [ready, setReady] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [pendingCount, setPendingCount] = React.useState(0);

  const [deviceId, setDeviceId] = React.useState("");
  const [snapshot, setSnapshot] = React.useState<MenuSnapshot | null>(() =>
    initialSnapshot ? { ...initialSnapshot, fetchedAt: 0 } : null,
  );
  const [tableSlug, setTableSlugState] = React.useState<string | null>(null);

  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());
  const [history, setHistory] = React.useState<OrderView[]>([]);
  const [stats, setStats] = React.useState<HistoryStat[]>([]);
  const [cart, setCart] = React.useState<CartLine[]>([]);

  /* ------------------------------------------------------------- syncing */

  const refreshAll = React.useCallback(async (id?: string) => {
    const device = id || getDeviceId();
    setSyncing(true);

    try {
      // Push queued writes first so the history we pull includes them.
      const flush = await flushOutbox();
      setPendingCount(flush.remaining);

      const menu = await pullMenu();
      setOnline(menu.ok);

      if (menu.snapshot) {
        setSnapshot(menu.snapshot);
        setLastSyncedAt(menu.snapshot.fetchedAt);
      }

      if (menu.ok && device) {
        const [favoriteIds, orders] = await Promise.all([
          pullFavorites(device),
          pullHistory(device),
        ]);

        if (favoriteIds) setFavorites(new Set(favoriteIds));
        if (orders) setHistory(orders);

        // History endpoint returns stats alongside orders.
        try {
          const response = await fetch(
            `/api/history?deviceId=${encodeURIComponent(device)}`,
            { cache: "no-store" },
          );
          if (response.ok) {
            const body = (await response.json()) as { stats: HistoryStat[] };
            setStats(body.stats ?? []);
          }
        } catch {
          /* offline; cached stats stay */
        }
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  /* --------------------------------------------------------------- boot */

  /**
   * Paint from IndexedDB first, then sync. Declared after `refreshAll` so the
   * dependency is a real reference rather than a hoisting accident.
   */
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const id = getDeviceId();
      if (cancelled) return;
      setDeviceId(id);

      const [cachedMenu, cachedFavorites, cachedCart, slug, outbox] =
        await Promise.all([
          getCachedMenu(),
          getCachedFavorites(),
          getCachedCart<CartLine>(),
          getTableSlug(),
          getOutbox(),
        ]);

      if (cancelled) return;

      if (cachedMenu) {
        setSnapshot(cachedMenu);
        setLastSyncedAt(cachedMenu.fetchedAt);
      }
      setFavorites(new Set(cachedFavorites));
      setCart(cachedCart);
      setTableSlugState(slug);
      setPendingCount(outbox.length);
      setReady(true);

      await refreshAll(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  /* ------------------------------------------- react to connectivity */

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setOnline(true);
      void refreshAll();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // A phone that has been in a pocket wakes up with stale data and, often,
    // a stale idea of whether it has signal. Re-sync when it comes back.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // navigator.onLine lies on captive-portal wifi, so we also poll gently.
    const timer = window.setInterval(() => void refreshAll(), 90_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [refreshAll]);

  /* ---------------------------------------------- register service worker */

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // An unregistered worker only costs offline shell loading; the
      // IndexedDB cache still works.
    });
  }, []);

  /* ----------------------------------------------------------- favourites */

  const toggleFavorite = React.useCallback(
    (itemId: string) => {
      const device = deviceId || getDeviceId();
      const isFavorite = favorites.has(itemId);
      const next = !isFavorite;

      // Optimistic: the heart fills on tap, even with no signal.
      setFavorites((current) => {
        const updated = new Set(current);
        if (next) updated.add(itemId);
        else updated.delete(itemId);
        return updated;
      });

      void (async () => {
        await toggleCachedFavorite(itemId, next);
        await enqueue({
          kind: "favorite",
          // Keyed by item, so rapid toggling collapses to the final state.
          id: `fav-${itemId}`,
          createdAt: Date.now(),
          attempts: 0,
          payload: { deviceId: device, itemId, favorite: next },
        });

        const flush = await flushOutbox();
        setPendingCount(flush.remaining);
      })();
    },
    [deviceId, favorites],
  );

  /* ----------------------------------------------------------------- cart */

  const persistCart = React.useCallback((lines: CartLine[]) => {
    setCart(lines);
    void cacheCart(lines);
  }, []);

  const addToCart = React.useCallback(
    (item: MenuItem, options: SelectedOption[], qty = 1) => {
      const key = lineKey(item.id, options);

      const existing = cart.find((line) => line.lineId === key);
      const next = existing
        ? cart.map((line) =>
            line.lineId === key
              ? { ...line, qty: Math.min(99, line.qty + qty) }
              : line,
          )
        : [
            ...cart,
            {
              lineId: key,
              itemId: item.id,
              name: item.name,
              unitPrice: unitPriceWithOptions(item.price, options),
              imageUrl: item.imageUrl,
              qty,
              selectedOptions: options,
            },
          ];

      persistCart(next);
    },
    [cart, persistCart],
  );

  const setLineQty = React.useCallback(
    (lineId: string, qty: number) => {
      const clamped = Math.max(0, Math.min(99, qty));
      persistCart(
        clamped === 0
          ? cart.filter((line) => line.lineId !== lineId)
          : cart.map((line) =>
              line.lineId === lineId ? { ...line, qty: clamped } : line,
            ),
      );
    },
    [cart, persistCart],
  );

  const removeLine = React.useCallback(
    (lineId: string) => {
      persistCart(cart.filter((line) => line.lineId !== lineId));
    },
    [cart, persistCart],
  );

  const emptyCart = React.useCallback(() => {
    setCart([]);
    void clearCart();
  }, []);

  const cartTotals = React.useMemo(
    () =>
      computeTotals(
        cart.map((line) => ({ unitPrice: line.unitPrice, qty: line.qty })),
        snapshot?.settings.taxRate ?? "0",
        snapshot?.settings.serviceChargeRate ?? "0",
      ),
    [cart, snapshot],
  );

  const cartCount = React.useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  );

  /* ---------------------------------------------------------- submitting */

  const submitOrder = React.useCallback(
    async (note?: string): Promise<SubmitResult> => {
      if (!cart.length) {
        return { status: "error", message: "Your cart is empty." };
      }

      const device = deviceId || getDeviceId();
      const clientId = newId();

      const draft = {
        clientId,
        deviceId: device,
        tableSlug,
        note: note?.trim() || null,
        lines: cart.map((line) => ({
          itemId: line.itemId,
          qty: line.qty,
          selectedOptions: line.selectedOptions,
          note: line.note,
        })),
      };

      // Show it in history immediately — the customer's own record of what
      // they asked for, whether or not the server has heard about it yet.
      const optimistic: OrderView = {
        id: clientId,
        clientId,
        publicCode: "····",
        status: "PLACED",
        source: "CUSTOMER",
        tableLabel: null,
        subtotal: cartTotals.subtotal,
        tax: cartTotals.tax,
        serviceCharge: cartTotals.serviceCharge,
        total: cartTotals.total,
        note: draft.note,
        placedAt: new Date().toISOString(),
        acceptedAt: null,
        readyAt: null,
        servedAt: null,
        lines: cart.map((line) => ({
          id: line.lineId,
          itemId: line.itemId,
          name: line.name,
          unitPrice: line.unitPrice,
          qty: line.qty,
          selectedOptions: line.selectedOptions,
          lineTotal: computeTotals([line], "0", "0").subtotal,
          note: line.note ?? null,
        })),
      };

      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
          cache: "no-store",
        });

        if (response.ok) {
          const body = (await response.json()) as { publicCode: string };
          emptyCart();
          await prependHistory({ ...optimistic, publicCode: body.publicCode });
          void refreshAll(device);
          return { status: "sent", publicCode: body.publicCode };
        }

        // The menu moved under us, or orders are closed. Don't queue it —
        // retrying will not change the answer.
        if (response.status === 409 || response.status === 400) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          return {
            status: "error",
            message: body.error ?? "That order could not be placed.",
          };
        }

        throw new Error("server error");
      } catch {
        // No signal, or the server is down: queue it and tell the truth.
        await enqueue({
          kind: "order",
          id: clientId,
          createdAt: Date.now(),
          attempts: 0,
          payload: draft,
        });
        await prependHistory(optimistic);
        emptyCart();
        setPendingCount((count) => count + 1);
        return { status: "queued" };
      }
    },
    [cart, cartTotals, deviceId, emptyCart, refreshAll, tableSlug],
  );

  /* ---------------------------------------------------------------- table */

  const setTable = React.useCallback((slug: string | null) => {
    setTableSlugState(slug);
    void persistTableSlug(slug);
  }, []);

  /* --------------------------------------------------------------- value */

  const value = React.useMemo<MenuContextValue>(
    () => ({
      ready,
      online,
      syncing,
      lastSyncedAt,
      pendingCount,
      deviceId,
      snapshot,
      tableSlug,
      favorites,
      history,
      stats,
      cart,
      cartCount,
      cartTotals,
      setTable,
      toggleFavorite,
      addToCart,
      setLineQty,
      removeLine,
      emptyCart,
      submitOrder,
      refresh: () => refreshAll(),
    }),
    [
      ready,
      online,
      syncing,
      lastSyncedAt,
      pendingCount,
      deviceId,
      snapshot,
      tableSlug,
      favorites,
      history,
      stats,
      cart,
      cartCount,
      cartTotals,
      setTable,
      toggleFavorite,
      addToCart,
      setLineQty,
      removeLine,
      emptyCart,
      submitOrder,
      refreshAll,
    ],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}
