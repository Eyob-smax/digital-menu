import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The small set of primitives every screen is built from. Kept deliberately
 * few: a menu app that needs twenty component variants has a design problem,
 * not a component problem.
 */

/* ---------------------------------------------------------------- button */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium",
        "transition-[transform,background-color,opacity] duration-150 ease-out",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        // 44px minimum touch target, even at size sm.
        size === "sm" && "min-h-[38px] px-3.5 text-sm",
        size === "md" && "min-h-[44px] px-5 text-[0.95rem]",
        size === "lg" && "min-h-[52px] px-6 text-base",
        variant === "primary" &&
          "bg-accent text-accent-ink hover:bg-accent-strong",
        variant === "secondary" &&
          "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
        variant === "ghost" && "text-ink-muted hover:text-ink hover:bg-surface-2",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ card */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface-1",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- badge */

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "bg-surface-2 text-ink-muted",
        tone === "accent" && "bg-accent/12 text-accent",
        tone === "success" && "bg-success/12 text-success",
        tone === "warning" && "bg-warning/12 text-warning",
        tone === "danger" && "bg-danger/12 text-danger",
        tone === "info" && "bg-info/12 text-info",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- input */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5",
        "text-ink placeholder:text-ink-faint",
        "min-h-[44px] transition-colors focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5",
        "text-ink placeholder:text-ink-faint resize-y",
        "transition-colors focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5",
        "text-ink min-h-[44px] transition-colors focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

/* ----------------------------------------------------------------- label */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink-muted", className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------- skeleton */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-xl", className)} {...props} />;
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-ink-faint">{icon}</div> : null}
      <p className="font-display text-lg text-ink">{title}</p>
      {hint ? (
        <p className="mt-1.5 max-w-xs text-sm text-ink-muted">{hint}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- spinner */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
