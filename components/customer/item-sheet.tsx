"use client";

import * as React from "react";
import { Flame, Heart, Minus, Plus, X } from "lucide-react";

import { useMenu } from "@/components/menu-provider";
import { Badge, Button } from "@/components/ui";
import { formatMoney, multiplyMoney, unitPriceWithOptions } from "@/lib/money";
import type { MenuItem, SelectedOption } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Item detail, as a bottom sheet rather than a page.
 *
 * A sheet keeps the customer's place in the menu — closing it returns them to
 * the same scroll position, which matters when you're comparing three dishes.
 * It also gives the option picker somewhere to live without a route change.
 */
export function ItemSheet({
  item,
  currency,
  canOrder,
  timesOrdered,
  onClose,
}: {
  item: MenuItem | null;
  currency: string;
  canOrder: boolean;
  timesOrdered?: number;
  onClose: () => void;
}) {
  const { favorites, toggleFavorite, addToCart } = useMenu();

  // Group options for rendering: "Size" -> [Small, Large].
  const groups = React.useMemo(() => {
    if (!item) return [];
    const map = new Map<string, MenuItem["options"]>();
    for (const option of item.options) {
      const list = map.get(option.groupName) ?? [];
      list.push(option);
      map.set(option.groupName, list);
    }
    return Array.from(map.entries());
  }, [item]);

  const [qty, setQty] = React.useState(1);
  const [chosen, setChosen] = React.useState<Record<string, string>>({});

  /**
   * Reset to this item's defaults when a different item is opened. Keying off
   * the rendered id and adjusting during render is React's documented pattern
   * for derived state — an effect would paint the previous item's selections
   * for a frame first.
   */
  const [renderedItemId, setRenderedItemId] = React.useState(item?.id ?? null);

  if (item && item.id !== renderedItemId) {
    setRenderedItemId(item.id);
    setQty(1);

    const defaults: Record<string, string> = {};
    for (const [groupName, options] of groups) {
      const preferred = options.find((o) => o.isDefault) ?? options[0];
      if (preferred) defaults[groupName] = preferred.label;
    }
    setChosen(defaults);
  }

  // Close on Escape, and lock the page behind the sheet from scrolling.
  React.useEffect(() => {
    if (!item) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [item, onClose]);

  if (!item) return null;

  const selectedOptions: SelectedOption[] = groups
    .map(([groupName, options]) => {
      const label = chosen[groupName];
      const option = options.find((o) => o.label === label);
      return option
        ? { groupName, label: option.label, priceDelta: option.priceDelta }
        : null;
    })
    .filter((o): o is SelectedOption => Boolean(o));

  const unitPrice = unitPriceWithOptions(item.price, selectedOptions);
  const lineTotal = multiplyMoney(unitPrice, qty);
  const isFavorite = favorites.has(item.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className={cn(
          "animate-rise relative flex max-h-[92vh] w-full max-w-lg flex-col",
          "rounded-t-[28px] border border-line bg-surface-1",
          "pb-[env(safe-area-inset-bottom)] sm:mb-6 sm:rounded-[28px]",
        )}
      >
        {/* Drag affordance */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-3" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-0/80 text-ink-muted backdrop-blur"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-5">
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="mb-4 h-52 w-full rounded-2xl object-cover"
            />
          )}

          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl leading-tight font-semibold text-ink">
              {item.name}
            </h2>

            <button
              type="button"
              onClick={() => toggleFavorite(item.id)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? "Remove from favourites" : "Save to favourites"
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 active:scale-90"
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  isFavorite ? "fill-danger text-danger" : "text-ink-muted",
                )}
              />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {item.spiceLevel > 0 && (
              <Badge tone="danger" className="gap-1">
                {Array.from({ length: item.spiceLevel }).map((_, i) => (
                  <Flame key={i} className="h-3 w-3" />
                ))}
                Spicy
              </Badge>
            )}
            {item.prepMinutes ? (
              <Badge>~{item.prepMinutes} min</Badge>
            ) : null}
            {item.calories ? <Badge>{item.calories} kcal</Badge> : null}
            {timesOrdered && timesOrdered >= 2 ? (
              <Badge tone="info">You&rsquo;ve ordered this {timesOrdered}×</Badge>
            ) : null}
            {item.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>

          {(item.longDescription || item.description) && (
            <p className="mt-3.5 text-[0.95rem] leading-relaxed text-ink-muted">
              {item.longDescription || item.description}
            </p>
          )}

          {groups.map(([groupName, options]) => (
            <fieldset key={groupName} className="mt-5">
              <legend className="mb-2 text-sm font-medium text-ink">
                {groupName}
              </legend>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const active = chosen[groupName] === option.label;
                  const delta = Number(option.priceDelta);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setChosen((current) => ({
                          ...current,
                          [groupName]: option.label,
                        }))
                      }
                      aria-pressed={active}
                      className={cn(
                        "min-h-[44px] rounded-full border px-4 text-sm transition-colors",
                        active
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-line bg-surface-2 text-ink-muted",
                      )}
                    >
                      {option.label}
                      {delta !== 0 && (
                        <span className="ml-1.5 text-xs opacity-80">
                          {delta > 0 ? "+" : ""}
                          {formatMoney(option.priceDelta, currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* Action bar */}
        <div className="shrink-0 border-t border-line bg-surface-1 px-5 py-3.5">
          {canOrder && item.isAvailable ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="w-7 text-center text-base font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  addToCart(item, selectedOptions, qty);
                  onClose();
                }}
              >
                Add · {formatMoney(lineTotal, currency)}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-xl font-semibold text-accent">
                {formatMoney(unitPrice, currency)}
              </span>
              <p className="text-right text-sm text-ink-muted">
                {item.isAvailable
                  ? "Tell your server to order this"
                  : "Not available right now"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
