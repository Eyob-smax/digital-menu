"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";

import { setTableSlug } from "@/lib/offline-store";

/**
 * Records which table the QR code belongs to, then forwards to the menu.
 *
 * Shows a brief confirmation rather than redirecting instantly: the customer
 * should see that the app knows their table, so an order arriving at the
 * right seat isn't a surprise.
 */
export function TableBinder({ slug, label }: { slug: string; label: string }) {
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      await setTableSlug(slug);
      if (cancelled) return;

      const timer = window.setTimeout(() => router.replace("/"), 850);
      return () => window.clearTimeout(timer);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="animate-rise">
        <QrCode className="mx-auto mb-4 h-12 w-12 text-accent" />
        <h1 className="font-display text-2xl font-semibold text-ink">{label}</h1>
        <p className="mt-2 text-sm text-ink-muted">Opening the menu…</p>
      </div>
    </main>
  );
}
