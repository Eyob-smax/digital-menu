"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { useMenu, type SubmitResult } from "@/components/menu-provider";
import { Button, Card, EmptyState, Spinner, Textarea } from "@/components/ui";
import { formatMoney, multiplyMoney } from "@/lib/money";

/**
 * Review and send. Only reachable in ORDERING mode.
 *
 * The important behaviour here is honesty about what happened: an order that
 * reached the kitchen and an order sitting in the outbox look different and
 * say different things, because a customer who thinks food is coming when it
 * isn't will sit there hungry.
 */
export function CartScreen() {
  const router = useRouter();
  const {
    snapshot,
    cart,
    cartTotals,
    cartCount,
    setLineQty,
    removeLine,
    submitOrder,
    online,
  } = useMenu();

  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const settings = snapshot?.settings;
  const currency = settings?.currency ?? "ETB";
  const canOrder =
    settings?.mode === "ORDERING" && settings.acceptingOrders === true;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);

    const outcome = await submitOrder(note);

    setBusy(false);

    if (outcome.status === "error") {
      setError(outcome.message);
      return;
    }
    setResult(outcome);
  };

  /* ------------------------------------------------------ confirmation */

  if (result) {
    const queued = result.status === "queued";

    return (
      <div className="mx-auto w-full flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <div
          className={
            queued
              ? "mb-5 text-warning"
              : "animate-ring mb-5 rounded-full text-success"
          }
        >
          {queued ? (
            <CloudOff className="h-14 w-14" />
          ) : (
            <CheckCircle2 className="h-14 w-14" />
          )}
        </div>

        <h1 className="font-display text-2xl font-semibold text-ink">
          {queued ? "Saved — not sent yet" : "Order sent"}
        </h1>

        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
          {queued ? (
            <>
              You&rsquo;re offline, so this hasn&rsquo;t reached the kitchen. It
              will send automatically as soon as you have signal — or tell your
              server if you&rsquo;d rather not wait.
            </>
          ) : (
            <>
              Your order is with the kitchen. Quote{" "}
              <span className="font-semibold text-accent">
                {result.status === "sent" ? result.publicCode : ""}
              </span>{" "}
              if you need to ask about it.
            </>
          )}
        </p>

        <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
          <Link href="/history">
            <Button className="w-full" size="lg">
              Track your order
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary" className="w-full" size="lg">
              Back to the menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------- mode turned off */

  if (!canOrder) {
    return (
      <div className="mx-auto w-full min-h-dvh max-w-lg px-4 pt-6">
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Ordering is switched off"
          hint="Please tell your server what you'd like — they'll take it from here."
          action={
            <Link href="/">
              <Button>Back to the menu</Button>
            </Link>
          }
        />
      </div>
    );
  }

  /* --------------------------------------------------------- empty cart */

  if (!cart.length) {
    return (
      <div className="mx-auto w-full min-h-dvh max-w-lg px-4 pt-6">
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Your order is empty"
          hint="Add something from the menu and it'll show up here."
          action={
            <Link href="/">
              <Button>Browse the menu</Button>
            </Link>
          }
        />
      </div>
    );
  }

  /* --------------------------------------------------------------- cart */

  return (
    <div className="mx-auto w-full min-h-dvh max-w-lg pb-44">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-surface-0/92 px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3 backdrop-blur-lg">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-semibold text-ink">
          Your order
        </h1>
      </header>

      <main className="space-y-4 px-4">
        <div className="space-y-2.5">
          {cart.map((line) => (
            <Card key={line.lineId} className="flex gap-3 p-3">
              {line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{line.name}</p>

                {line.selectedOptions.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {line.selectedOptions.map((o) => o.label).join(" · ")}
                  </p>
                )}

                <p className="mt-1 text-sm tabular-nums text-accent">
                  {formatMoney(multiplyMoney(line.unitPrice, line.qty), currency)}
                </p>

                <div className="mt-2 flex items-center gap-1">
                  <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5">
                    <button
                      type="button"
                      onClick={() => setLineQty(line.lineId, line.qty - 1)}
                      aria-label={`One fewer ${line.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLineQty(line.lineId, line.qty + 1)}
                      aria-label={`One more ${line.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    aria-label={`Remove ${line.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint active:bg-surface-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <label
            htmlFor="order-note"
            className="mb-1.5 block text-sm font-medium text-ink-muted"
          >
            Anything the kitchen should know?
          </label>
          <Textarea
            id="order-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Allergies, no onions, extra napkins…"
          />
        </div>

        <Card className="divide-y divide-[var(--color-line)]">
          <Row label="Subtotal" value={formatMoney(cartTotals.subtotal, currency)} />
          {Number(settings?.taxRate ?? 0) > 0 && (
            <Row label="Tax" value={formatMoney(cartTotals.tax, currency)} />
          )}
          {Number(settings?.serviceChargeRate ?? 0) > 0 && (
            <Row
              label="Service"
              value={formatMoney(cartTotals.serviceCharge, currency)}
            />
          )}
          <div className="flex items-center justify-between px-3.5 py-3">
            <span className="font-medium text-ink">Total</span>
            <span className="font-display text-lg font-semibold tabular-nums text-accent">
              {formatMoney(cartTotals.total, currency)}
            </span>
          </div>
        </Card>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-0/95 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
        <div className="mx-auto w-full max-w-lg">
          {!online && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <CloudOff className="h-3.5 w-3.5" />
              You&rsquo;re offline — this will send when you reconnect.
            </p>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4" />
                Sending…
              </>
            ) : (
              <>
                Place order · {cartCount} item{cartCount > 1 ? "s" : ""} ·{" "}
                {formatMoney(cartTotals.total, currency)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm tabular-nums text-ink">{value}</span>
    </div>
  );
}
