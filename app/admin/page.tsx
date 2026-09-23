import Link from "next/link";
import { AlertTriangle, ArrowRight, Receipt, TrendingUp } from "lucide-react";

import { ModeSwitch } from "@/components/admin/mode-switch";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import {
  getDashboardStats,
  getItemPopularity,
  getPublicSettings,
  getRecentOrders,
} from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

/** Start of the current day in the server's timezone. */
function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export default async function AdminDashboard() {
  const since = startOfToday();

  const [settings, stats, popular, recent] = await Promise.all([
    getPublicSettings(),
    getDashboardStats(since),
    getItemPopularity(5),
    getRecentOrders(6),
  ]);

  return (
    <div className="space-y-7">
      <ModeSwitch
        mode={settings.mode}
        acceptingOrders={settings.acceptingOrders}
      />

      {/* -------------------------------------------------------- today */}
      <section>
        <h2 className="font-display mb-2.5 text-lg font-semibold text-ink">
          Today
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Orders" value={String(stats.orderCount)} />
          <Stat
            label="Revenue"
            value={formatMoney(stats.revenue, settings.currency)}
          />
          <Stat label="Open now" value={String(stats.open)} highlight={stats.open > 0} />
          <Stat
            label="On the menu"
            value={`${stats.itemCount - stats.unavailableCount}/${stats.itemCount}`}
          />
        </div>

        {stats.unavailableCount > 0 && (
          <Link href="/admin/menu">
            <Card className="mt-3 flex items-center gap-2.5 p-3 text-sm text-ink-muted transition-colors hover:bg-surface-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="flex-1">
                {stats.unavailableCount} item
                {stats.unavailableCount > 1 ? "s are" : " is"} marked
                unavailable.
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Card>
          </Link>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------ most ordered */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
              <TrendingUp className="h-4.5 w-4.5 text-accent" />
              Most ordered
            </h2>
            <Link
              href="/admin/analytics"
              className="text-sm text-accent hover:underline"
            >
              See all
            </Link>
          </div>

          {popular.length === 0 || popular.every((p) => p.unitsSold === 0) ? (
            <Card className="p-5 text-sm text-ink-muted">
              No orders recorded yet. Counts appear here once orders are marked
              served.
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--color-line)]">
              {popular.map((item, index) => (
                <div
                  key={item.itemId}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="w-5 text-sm font-semibold text-ink-faint tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                    {item.unitsSold} sold
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* -------------------------------------------------- recent */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold text-ink">
              <Receipt className="h-4.5 w-4.5 text-ink-muted" />
              Latest orders
            </h2>
            <Link href="/staff" className="text-sm text-accent hover:underline">
              Order screen
            </Link>
          </div>

          {recent.length === 0 ? (
            <Card className="p-5 text-sm text-ink-muted">
              No orders yet.
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--color-line)]">
              {recent.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="font-display shrink-0 font-semibold text-accent">
                    {order.publicCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {order.lines.length} item
                      {order.lines.length > 1 ? "s" : ""}
                      {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {timeAgo(order.placedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                    {formatMoney(order.total, settings.currency)}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className="p-3.5">
      <p className="text-xs tracking-wide text-ink-muted uppercase">{label}</p>
      <p
        className={`font-display mt-1 text-2xl font-semibold tabular-nums ${
          highlight ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
