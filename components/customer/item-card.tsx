"use client";

import * as React from "react";
import { Flame, Heart, Plus, Repeat } from "lucide-react";

import { useMenu } from "@/components/menu-provider";
import { Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One dish on the menu.
 *
 * Layout choice: image on the right at a fixed 96px, text on the left. That
 * keeps every card the same height regardless of photo aspect ratio, so the
 * list scans as a rhythm rather than a jumble — and items without a photo
 * don't look broken.
 */
export function ItemCard({
  item,
  currency,
  canOrder,
  timesOrdered,
  onOpen,
}: {
  item: MenuItem;
  currency: string;
  canOrder: boolean;
  /** How often this customer has had it before; drives the "usual" tag. */
  timesOrdered?: number;
  onOpen: (item: MenuItem) => void;
}) {
  const { favorites, toggleFavorite, addToCart } = useMenu();
  const isFavorite = favorites.has(item.id);

  const hasOptions = item.options.length > 0;

  return (
    <div
      className={cn(
        "group relative flex gap-3.5 rounded-[var(--radius-card)] border border-line",
        "bg-surface-1 p-3 transition-colors duration-150",
        "active:bg-surface-2",
        !item.isAvailable && "opacity-55",
      )}
    >
      {/* The whole card opens the detail sheet. */}
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="absolute inset-0 z-0 rounded-[var(--radius-card)]"
        aria-label={`View ${item.name}`}
      />

      <div className="pointer-events-none relative z-10 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-display text-[1.05rem] leading-tight font-semibold text-ink">
            {item.name}
          </h3>
          {item.spiceLevel > 0 && (
            <span
              className="inline-flex items-center"
              aria-label={`Spice level ${item.spiceLevel} of 3`}
            >
              {Array.from({ length: item.spiceLevel }).map((_, i) => (
                <Flame key={i} className="h-3.5 w-3.5 text-danger" />
              ))}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-muted">
            {item.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.95rem] font-semibold text-accent">
            {formatMoney(item.price, currency)}
          </span>

          {hasOptions && (
            <span className="text-xs text-ink-faint">+ options</span>
          )}

          {!item.isAvailable && (
            <Badge tone="danger">Sold out</Badge>
          )}

          {item.isFeatured && item.isAvailable && (
            <Badge tone="accent">Chef&rsquo;s pick</Badge>
          )}

          {/* Personal signal: quietly surfaces what they actually order. */}
          {timesOrdered && timesOrdered >= 2 ? (
            <Badge tone="info" className="gap-1">
              <Repeat className="h-3 w-3" />
              Ordered {timesOrdered}×
            </Badge>
          ) : null}

          {item.tags.slice(0, 2).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-end justify-between">
        <div className="relative">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="pointer-events-none h-24 w-24 rounded-xl object-cover"
            />
          ) : (
            <div className="pointer-events-none flex h-24 w-24 items-center justify-center rounded-xl bg-surface-2">
              <span className="font-display text-2xl text-ink-faint">
                {item.name.slice(0, 1)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(item.id);
            }}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `Remove ${item.name} from favourites`
                : `Save ${item.name} to favourites`
            }
            className={cn(
              "absolute -top-1.5 -left-1.5 flex h-9 w-9 items-center justify-center",
              "rounded-full border border-line bg-surface-0/90 backdrop-blur",
              "transition-transform duration-150 active:scale-90",
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorite ? "fill-danger text-danger" : "text-ink-muted",
              )}
            />
          </button>
        </div>

        {canOrder && item.isAvailable && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              // Items with choices need the sheet; simple items add in one tap.
              if (hasOptions) {
                onOpen(item);
                return;
              }
              addToCart(item, []);
            }}
            aria-label={`Add ${item.name} to order`}
            className={cn(
              "mt-2 flex h-10 w-10 items-center justify-center rounded-full",
              "bg-accent text-accent-ink transition-transform duration-150",
              "active:scale-90",
            )}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
