"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  ChefHat,
  Check,
  CloudOff,
  RefreshCw,
  X,
} from "lucide-react";

import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { OrderStatus, OrderView } from "@/lib/types";
import { cn, elapsed } from "@/lib/utils";

/**
 * The kitchen / waitstaff queue.
 *
 * Polls every 3 seconds. A restaurant does not need sub-second latency, and
 * polling survives flaky wifi, sleeping tablets and serverless hosting in a
 * way a long-lived socket does not — it just retries and carries on.
 *
 * Designed to be read across a counter: big type, colour-coded columns, and
 * an elapsed clock per ticket so nothing quietly ages out of sight.
 */

const POLL_MS = 3000;

const COLUMNS: { status: OrderStatus; title: string; tone: string }[] = [
  { status: "PLACED", title: "New", tone: "text-info" },
  { status: "PREPARING", title: "Cooking", tone: "text-warning" },
  { status: "READY", title: "Ready to serve", tone: "text-success" },
];

const NEXT_ACTION: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus }>
> = {
  PLACED: { label: "Start", next: "PREPARING" },
  PREPARING: { label: "Ready", next: "READY" },
  READY: { label: "Served", next: "SERVED" },
};

export function StaffScreen({
  initialOrders,
  currency,
}: {
  initialOrders: OrderView[];
  currency: string;
}) {
  const [orders, setOrders] = React.useState(initialOrders);
  const [connected, setConnected] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [soundOn, setSoundOn] = React.useState(false);
  // A clock that ticks once a second, so the elapsed timers advance without
  // any component calling Date.now() during render.
  const [now, setNow] = React.useState(() => Date.now());

  const knownIds = React.useRef(new Set(initialOrders.map((o) => o.id)));

  /* ----------------------------------------------------------- polling */

  const poll = React.useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("bad response");

      const body = (await response.json()) as { orders: OrderView[] };
      setConnected(true);

      // Chime only for orders we haven't seen before.
      const incoming = body.orders.filter((o) => !knownIds.current.has(o.id));
      if (incoming.length && soundOn) chime();
      for (const order of body.orders) knownIds.current.add(order.id);

      setOrders(body.orders);
    } catch {
      setConnected(false);
    }
  }, [soundOn]);

  React.useEffect(() => {
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---------------------------------------------------------- mutation */

  const advance = async (order: OrderView, next: OrderStatus) => {
    setBusyId(order.id);

    // Optimistic: the tap should feel instant on a busy pass.
    setOrders((current) =>
      next === "SERVED" || next === "CANCELLED"
        ? current.filter((o) => o.id !== order.id)
        : current.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    );

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error("rejected");
    } catch {
      // Put it back and let the next poll reconcile.
      await poll();
    } finally {
      setBusyId(null);
    }
  };

  const byStatus = (status: OrderStatus) =>
    orders.filter((order) => order.status === status);

  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/95 backdrop-blur-lg">
        <div className="mx-auto w-full flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChefHat className="h-6 w-6 text-accent" />
            <h1 className="font-display text-xl font-semibold text-ink">
              Orders
            </h1>
            <Badge tone={orders.length ? "accent" : "neutral"}>
              {orders.length} open
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // Priming inside the click satisfies browser autoplay rules.
                if (!soundOn) chime();
                setSoundOn((on) => !on);
              }}
              aria-pressed={soundOn}
              aria-label={
                soundOn ? "Mute new-order sound" : "Play a sound on new orders"
              }
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
            >
              {soundOn ? (
                <Bell className="h-5 w-5 text-accent" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void poll()}
              aria-label="Refresh now"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
            >
              <RefreshCw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {!connected && (
          <div
            role="status"
            className="flex items-center gap-2 bg-danger/12 px-4 py-2 text-xs text-danger"
          >
            <CloudOff className="h-3.5 w-3.5" />
            Lost connection to the server — retrying every few seconds.
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-4">
        {orders.length === 0 ? (
          <EmptyState
            icon={<ChefHat className="h-10 w-10" />}
            title="No open orders"
            hint="New orders appear here automatically."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {COLUMNS.map((column) => {
              const columnOrders = byStatus(column.status);

              return (
                <section key={column.status}>
                  <h2
                    className={cn(
                      "mb-2.5 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase",
                      column.tone,
                    )}
                  >
                    {column.title}
                    <span className="text-ink-faint">
                      {columnOrders.length}
                    </span>
                  </h2>

                  <div className="space-y-2.5">
                    {columnOrders.map((order) => (
                      <OrderTicket
                        key={order.id}
                        order={order}
                        currency={currency}
                        busy={busyId === order.id}
                        now={now}
                        onAdvance={advance}
                      />
                    ))}

                    {columnOrders.length === 0 && (
                      <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
                        Nothing here
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ ticket */

function OrderTicket({
  order,
  currency,
  busy,
  now,
  onAdvance,
}: {
  order: OrderView;
  currency: string;
  busy: boolean;
  /** Passed in from the parent's 1s tick, so render stays pure. */
  now: number;
  onAdvance: (order: OrderView, next: OrderStatus) => void;
}) {
  const action = NEXT_ACTION[order.status];
  const age = Math.round((now - new Date(order.placedAt).getTime()) / 60000);

  return (
    <Card
      className={cn(
        "animate-rise overflow-hidden",
        // A ticket older than 15 minutes earns a warning edge.
        age >= 15 && order.status !== "READY" && "border-danger/60",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-semibold text-accent">
            {order.publicCode}
          </span>
          {order.tableLabel && (
            <Badge tone="neutral">{order.tableLabel}</Badge>
          )}
        </div>

        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            age >= 15 ? "text-danger" : "text-ink-muted",
          )}
        >
          {elapsed(order.placedAt, now)}
        </span>
      </div>

      <ul className="divide-y divide-[var(--color-line)]">
        {order.lines.map((line) => (
          <li key={line.id} className="px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="font-display text-base font-semibold tabular-nums text-ink">
                {line.qty}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] leading-snug text-ink">
                  {line.name}
                </p>
                {line.selectedOptions.length > 0 && (
                  <p className="text-xs text-ink-muted">
                    {line.selectedOptions.map((o) => o.label).join(" · ")}
                  </p>
                )}
                {line.note && (
                  <p className="mt-0.5 text-xs font-medium text-warning">
                    ⚠ {line.note}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="border-t border-line bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          ⚠ {order.note}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <span className="flex-1 text-sm tabular-nums text-ink-muted">
          {formatMoney(order.total, currency)}
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onAdvance(order, "CANCELLED")}
          aria-label={`Cancel order ${order.publicCode}`}
        >
          <X className="h-4 w-4" />
        </Button>

        {action && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAdvance(order, action.next)}
          >
            {busy ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------- sound */

/**
 * A short two-tone chime via WebAudio. No audio file to ship, no autoplay
 * policy to fight beyond the initial user gesture.
 */
function chime() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    const now = context.currentTime;

    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const start = now + index * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    }

    window.setTimeout(() => void context.close(), 800);
  } catch {
    /* sound is a nicety, never a failure */
  }
}
