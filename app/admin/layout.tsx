import Link from "next/link";
import {
  BarChart3,
  ChefHat,
  LayoutDashboard,
  QrCode,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

import { SignOutButton } from "@/components/admin/sign-out-button";
import { requireAdmin } from "@/lib/guard";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/tables", label: "Tables", icon: QrCode },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Admin shell. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/95 backdrop-blur-lg">
        <div className="mx-auto w-full flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChefHat className="h-5 w-5 shrink-0 text-accent" />
            <span className="font-display truncate font-semibold text-ink">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/staff"
              className="text-sm text-ink-muted hover:text-ink"
            >
              Order screen
            </Link>
            <span className="hidden text-sm text-ink-faint sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>

        <nav className="no-scrollbar mx-auto w-full flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <entry.icon className="h-4 w-4" />
              {entry.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
