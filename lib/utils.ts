import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "2 minutes ago" — for order timers and the last-synced label. */
export function timeAgo(iso: string | number | Date): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Minutes and seconds since an order was placed, for the kitchen clock.
 * `now` is passed in so callers can render purely from a ticking state value
 * rather than reading the clock during render.
 */
export function elapsed(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Stable key for a cart line: same dish with different options is a new line. */
export function lineKey(
  itemId: string,
  options: { groupName: string; label: string }[],
): string {
  const signature = [...options]
    .sort((a, b) =>
      `${a.groupName}${a.label}`.localeCompare(`${b.groupName}${b.label}`),
    )
    .map((o) => `${o.groupName}:${o.label}`)
    .join("|");
  return signature ? `${itemId}__${signature}` : itemId;
}
