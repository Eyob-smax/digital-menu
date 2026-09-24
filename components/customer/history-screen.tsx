"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Clock, History, Trophy } from "lucide-react";

import { useMenu } from "@/components/menu-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Sent to kitchen",
  PREPARING: "Being prepared",
  READY: "Ready",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<
  OrderStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  PLACED: "info",
  PREPARING: "warning",
  READY: "success",
  SERVED: "neutral",
  CANCELLED: "danger",
};

/**
 * The customer's own record: what they've ordered, and what they order most.
 *
 * The "your usuals" list is the answer to "see how often they order that" —
 * counted per dish across every order this device has placed.
 */
export function HistoryScreen() {
  const { ready, snapshot, history, stats, online } = useMenu();

  const currency = snapshot?.settings.currency ?? "ETB";
  const topStats = stats.slice(0, 6);

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
          Your orders
        </h1>
        <ThemeToggle className="ml-auto" />
      </header>

      <main className="space-y-6 px-4">
        {!ready && !history.length ? (
          <div className="space-y-3 pt-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !history.length && !stats.length ? (
          <EmptyState
            icon={<History className="h-10 w-10" />}
            title="No orders yet"
            hint={
              online
                ? "Once you order, everything you've had will show up here."
                : "You're offline — any past orders will appear when you reconnect."
            }
            action={
              <Link href="/">
                <Button>Browse the menu</Button>
              </Link>
            }
          />
        ) : null}

        {/* ------------------------------------------------- your usuals */}
        {topStats.length > 0 && (
          <section className="pt-2">
            <div className="mb-2.5 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent-text" />
              <h2 className="font-display text-[1.1rem] font-semibold text-ink">
                Your usuals
              </h2>
            </div>

            <div className="space-y-2">
              {topStats.map((stat, index) => (
                <Card
                  key={stat.itemId}
                  className="flex items-center gap-3 p-2.5"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      index === 0
                        ? "bg-accent text-accent-ink"
                        : "bg-surface-2 text-ink-muted",
                    )}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </div>

                  {stat.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stat.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{stat.name}</p>
                    <p className="text-xs text-ink-muted">
                      Ordered {stat.timesOrdered}×
                      {stat.unitsOrdered !== stat.timesOrdered
                        ? ` · ${stat.unitsOrdered} in total`
                        : ""}
                      {" · "}
                      {timeAgo(stat.lastOrderedAt)}
                    </p>
                  </div>

                  {!stat.stillOnMenu && (
                    <Badge tone="neutral" className="shrink-0">
                      Off menu
                    </Badge>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------------- past orders */}
        {history.length > 0 && (
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-muted" />
              <h2 className="font-display text-[1.1rem] font-semibold text-ink">
                Past orders
              </h2>
            </div>

            <div className="space-y-3">
              {history.map((order) => {
                const pending = order.publicCode === "····";

                return (
                  <Card key={order.clientId} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {pending ? "Waiting to send" : `Order ${order.publicCode}`}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {timeAgo(order.placedAt)}
                          {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                        </p>
                      </div>

                      <Badge
                        tone={pending ? "warning" : STATUS_TONE[order.status]}
                      >
                        {pending ? "Not sent yet" : STATUS_LABEL[order.status]}
                      </Badge>
                    </div>

                    <ul className="divide-y divide-[var(--color-line)]">
                      {order.lines.map((line) => (
                        <li
                          key={line.id}
                          className="flex items-start justify-between gap-3 px-3.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink">
                              <span className="text-ink-muted tabular-nums">
                                {line.qty}×
                              </span>{" "}
                              {line.name}
                            </p>
                            {line.selectedOptions.length > 0 && (
                              <p className="text-xs text-ink-faint">
                                {line.selectedOptions
                                  .map((o) => o.label)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                            {formatMoney(line.lineTotal, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-sm text-ink-muted">Total</span>
                      <span className="font-semibold tabular-nums text-accent-text">
                        {formatMoney(order.total, currency)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
