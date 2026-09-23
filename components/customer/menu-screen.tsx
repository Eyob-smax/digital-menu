"use client";

import * as React from "react";
import Link from "next/link";
import {
  CloudOff,
  Heart,
  History,
  RefreshCw,
  Search,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { useMenu } from "@/components/menu-provider";
import { ItemCard } from "@/components/customer/item-card";
import { ItemSheet } from "@/components/customer/item-sheet";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

/**
 * The main customer screen.
 *
 * Structure is driven by how a menu is actually used: a sticky header that
 * stays out of the way, a category rail for jumping, and a single scrolling
 * list of sections. Search is present but secondary — most people browse.
 */
export function MenuScreen() {
  const {
    ready,
    online,
    syncing,
    lastSyncedAt,
    pendingCount,
    snapshot,
    stats,
    cartCount,
    cartTotals,
    tableSlug,
    refresh,
  } = useMenu();

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [openItem, setOpenItem] = React.useState<MenuItem | null>(null);

  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const settings = snapshot?.settings;
  const canOrder =
    settings?.mode === "ORDERING" && settings.acceptingOrders === true;
  const currency = settings?.currency ?? "ETB";

  /** How many times this customer has ordered each dish. */
  const orderCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const stat of stats) map.set(stat.itemId, stat.timesOrdered);
    return map;
  }, [stats]);

  const visibleItems = React.useMemo(() => {
    if (!snapshot) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return snapshot.items;

    return snapshot.items.filter((item) =>
      [item.name, item.description ?? "", ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [snapshot, query]);

  const sections = React.useMemo(() => {
    if (!snapshot) return [];
    return snapshot.categories
      .map((category) => ({
        category,
        items: visibleItems
          .filter((item) => item.categoryId === category.id)
          // Sold-out dishes stay visible but sink to the bottom of their
          // section, so what's actually orderable is what's in front of you.
          .sort(
            (a, b) => Number(b.isAvailable) - Number(a.isAvailable),
          ),
      }))
      .filter((section) => section.items.length > 0);
  }, [snapshot, visibleItems]);

  /** Highlights the category rail chip for whatever section is on screen. */
  React.useEffect(() => {
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveCategory(visible.target.id);
      },
      // Top band only, so the "current" section is the one under the header.
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const node = sectionRefs.current[section.category.id];
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [sections]);

  const scrollToCategory = (categoryId: string) => {
    const node = sectionRefs.current[categoryId];
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - 108;
    window.scrollTo({ top, behavior: "smooth" });
  };

  /* --------------------------------------------------------------- loading */

  if (!ready && !snapshot) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-32" />
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <EmptyState
        icon={<CloudOff className="h-10 w-10" />}
        title="No menu saved yet"
        hint="Connect to the internet once and the menu will be available offline from then on."
        action={<Button onClick={() => void refresh()}>Try again</Button>}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 bg-surface-0/92 backdrop-blur-lg">
        <div className="px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display truncate text-[1.6rem] leading-tight font-semibold text-ink">
                {settings?.restaurantName}
              </h1>
              <p className="mt-0.5 truncate text-[0.82rem] text-ink-muted">
                {tableSlug ? (
                  <>Table&nbsp;·&nbsp;{tableSlug}</>
                ) : (
                  settings?.tagline || "Today's menu"
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSearching((s) => !s)}
                aria-label={searching ? "Close search" : "Search the menu"}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
              >
                {searching ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>

              <Link
                href="/favorites"
                aria-label="Favourites"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
              >
                <Heart className="h-5 w-5" />
              </Link>

              <Link
                href="/history"
                aria-label="Your order history"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
              >
                <History className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {searching && (
            <div className="animate-rise relative mt-2.5">
              <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dishes, ingredients…"
                aria-label="Search the menu"
                className="min-h-[44px] w-full rounded-full border border-line bg-surface-2 pr-4 pl-10 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Category rail */}
        {!query && sections.length > 1 && (
          <nav
            aria-label="Menu categories"
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5"
          >
            {sections.map(({ category }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => scrollToCategory(category.id)}
                className={cn(
                  "min-h-[36px] shrink-0 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                  activeCategory === category.id
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface-1 text-ink-muted",
                )}
              >
                {category.name}
              </button>
            ))}
          </nav>
        )}

        {/* Connectivity banner — honest about what the customer is looking at. */}
        {(!online || pendingCount > 0) && (
          <div
            role="status"
            className="flex items-center gap-2 border-y border-line bg-surface-2 px-4 py-2 text-xs text-ink-muted"
          >
            <CloudOff className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {pendingCount > 0 ? (
                <>
                  {pendingCount} change{pendingCount > 1 ? "s" : ""} waiting to
                  send.
                </>
              ) : (
                <>Offline — showing the menu saved on this phone.</>
              )}
              {lastSyncedAt ? ` Updated ${timeAgo(lastSyncedAt)}.` : ""}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 text-accent"
              aria-label="Retry sync"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            </button>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- body */}
      <main className="px-4 pt-3">
        {/* Mode notice: sets expectations before anyone tries to order. */}
        {!canOrder && (
          <p className="mb-4 rounded-xl border border-line bg-surface-1 px-3.5 py-2.5 text-[0.82rem] leading-snug text-ink-muted">
            <UtensilsCrossed className="mr-1.5 inline h-3.5 w-3.5" />
            Browse the menu and save what you like — then tell your server what
            you&rsquo;d like to order.
          </p>
        )}

        {sections.length === 0 ? (
          <EmptyState
            icon={<Search className="h-9 w-9" />}
            title={query ? "Nothing matches that" : "The menu is empty"}
            hint={
              query
                ? "Try a different word, or browse the categories."
                : "Please ask your server for today's dishes."
            }
            action={
              query ? (
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          sections.map(({ category, items }) => (
            <section
              key={category.id}
              id={category.id}
              ref={(node) => {
                sectionRefs.current[category.id] = node;
              }}
              className="scroll-mt-28 pt-4 pb-1"
            >
              <div className="mb-2.5">
                <h2 className="font-display text-[1.15rem] font-semibold text-ink">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="mt-0.5 text-[0.82rem] text-ink-muted">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    currency={currency}
                    canOrder={canOrder}
                    timesOrdered={orderCounts.get(item.id)}
                    onOpen={setOpenItem}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* -------------------------------------------------------- cart bar */}
      {canOrder && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <Link href="/cart" className="mx-auto block max-w-lg">
            <div className="animate-rise flex items-center justify-between gap-3 rounded-full bg-accent px-5 py-3.5 text-accent-ink shadow-lg shadow-black/25">
              <span className="flex items-center gap-2 font-medium">
                <ShoppingBag className="h-5 w-5" />
                {cartCount} item{cartCount > 1 ? "s" : ""}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(cartTotals.total, currency)}
              </span>
            </div>
          </Link>
        </div>
      )}

      <ItemSheet
        item={openItem}
        currency={currency}
        canOrder={canOrder}
        timesOrdered={openItem ? orderCounts.get(openItem.id) : undefined}
        onClose={() => setOpenItem(null)}
      />
    </div>
  );
}
