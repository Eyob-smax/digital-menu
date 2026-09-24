"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";

import { useMenu } from "@/components/menu-provider";
import { ItemCard } from "@/components/customer/item-card";
import { ItemSheet } from "@/components/customer/item-sheet";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import type { MenuItem } from "@/lib/types";

export function FavoritesScreen() {
  const { ready, snapshot, favorites, stats } = useMenu();
  const [openItem, setOpenItem] = React.useState<MenuItem | null>(null);

  const settings = snapshot?.settings;
  const canOrder =
    settings?.mode === "ORDERING" && settings.acceptingOrders === true;

  const orderCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const stat of stats) map.set(stat.itemId, stat.timesOrdered);
    return map;
  }, [stats]);

  const saved = React.useMemo(
    () => snapshot?.items.filter((item) => favorites.has(item.id)) ?? [],
    [snapshot, favorites],
  );

  return (
    <div className="mx-auto w-full min-h-dvh max-w-lg pb-12">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-surface-0/92 px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3 backdrop-blur-lg">
        <Link
          href="/"
          aria-label="Back to the menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-ink">
          Your favourites
        </h1>
      </header>

      <main className="px-4">
        {!ready && !snapshot ? (
          <div className="space-y-3 pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-10 w-10" />}
            title="Nothing saved yet"
            hint="Tap the heart on any dish and it'll be waiting here next time — even without signal."
            action={
              <Link href="/">
                <Button>Browse the menu</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2.5 pt-1">
            {saved.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currency={settings?.currency ?? "ETB"}
                canOrder={canOrder}
                timesOrdered={orderCounts.get(item.id)}
                onOpen={setOpenItem}
              />
            ))}
          </div>
        )}
      </main>

      <ItemSheet
        item={openItem}
        currency={settings?.currency ?? "ETB"}
        canOrder={canOrder}
        timesOrdered={openItem ? orderCounts.get(openItem.id) : undefined}
        onClose={() => setOpenItem(null)}
      />
    </div>
  );
}
