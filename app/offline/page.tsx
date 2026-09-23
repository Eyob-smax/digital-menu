import Link from "next/link";
import { CloudOff } from "lucide-react";

/** Last-resort page the service worker serves when nothing is cached. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <CloudOff className="mb-4 h-12 w-12 text-ink-faint" />
      <h1 className="font-display text-2xl font-semibold text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        This page hasn&rsquo;t been saved to your phone yet. Reconnect once and
        the menu will be available offline from then on.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 font-medium text-accent-ink"
      >
        Back to the menu
      </Link>
    </main>
  );
}
