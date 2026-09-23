"use client";

import * as React from "react";
import { Eye, PauseCircle, PlayCircle, ShoppingBag } from "lucide-react";

import { setAcceptingOrders, setMode } from "@/app/admin/actions";
import { Card, Spinner } from "@/components/ui";
import type { AppMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The switch the whole product turns on.
 *
 * Presented as two explicit cards rather than a toggle, because the two modes
 * change what customers can do and the difference should be impossible to
 * misread at a glance.
 */
export function ModeSwitch({
  mode,
  acceptingOrders,
}: {
  mode: AppMode;
  acceptingOrders: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  /**
   * `useOptimistic` rather than mirrored state: the server value stays the
   * source of truth, the optimistic value applies only while the transition
   * is in flight, and React reverts it automatically if the action fails.
   * Copying props into state with an effect would fight the server instead.
   */
  const [optimisticMode, applyMode] = React.useOptimistic(mode);
  const [optimisticAccepting, applyAccepting] =
    React.useOptimistic(acceptingOrders);

  const choose = (next: AppMode) => {
    if (next === optimisticMode || pending) return;
    startTransition(async () => {
      applyMode(next);
      await setMode(next);
    });
  };

  const toggleAccepting = () => {
    startTransition(async () => {
      const next = !optimisticAccepting;
      applyAccepting(next);
      await setAcceptingOrders(next);
    });
  };

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">
          How the app is working right now
        </h2>
        {pending && <Spinner className="h-4 w-4 text-ink-muted" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={optimisticMode === "DISPLAY"}
          icon={<Eye className="h-5 w-5" />}
          title="Display only"
          description="Customers browse the menu, save favourites and see their history. They tell a server what they'd like."
          onClick={() => choose("DISPLAY")}
          disabled={pending}
        />

        <ModeCard
          active={optimisticMode === "ORDERING"}
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Ordering"
          description="Customers order from their phone. Orders appear on the staff screen with the table number."
          onClick={() => choose("ORDERING")}
          disabled={pending}
        />
      </div>

      {/* Only meaningful in ORDERING mode, so only shown there. */}
      {optimisticMode === "ORDERING" && (
        <Card className="mt-3 flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {optimisticAccepting
                ? "Taking new orders"
                : "New orders paused"}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {optimisticAccepting
                ? "Pause this if the kitchen needs to catch up — the menu stays visible."
                : "Customers can still browse, but can't send new orders."}
            </p>
          </div>

          <button
            type="button"
            onClick={toggleAccepting}
            disabled={pending}
            aria-pressed={optimisticAccepting}
            className={cn(
              "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
              optimisticAccepting
                ? "bg-warning/15 text-warning"
                : "bg-success/15 text-success",
            )}
          >
            {optimisticAccepting ? (
              <>
                <PauseCircle className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Resume
              </>
            )}
          </button>
        </Card>
      )}
    </section>
  );
}

function ModeCard({
  active,
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-card)] border p-4 text-left transition-colors",
        "disabled:opacity-70",
        active
          ? "border-accent bg-accent/10"
          : "border-line bg-surface-1 hover:bg-surface-2",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={active ? "text-accent" : "text-ink-muted"}>{icon}</span>
        <span
          className={cn(
            "font-display font-semibold",
            active ? "text-accent" : "text-ink",
          )}
        >
          {title}
        </span>
        {active && (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-ink">
            Live
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-snug text-ink-muted">{description}</p>
    </button>
  );
}
