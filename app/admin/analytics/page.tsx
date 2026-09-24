import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { requireAdmin } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { getItemFrequency, getPublicSettings } from "@/lib/queries";
import { cn, timeAgo } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 3650, label: "All time" },
];

/**
 * How often each dish is ordered, over a window.
 *
 * A ranked bar list rather than a chart library: the question is "what sells
 * and what doesn't", which a sorted list with proportional bars answers
 * faster than axes would — and it adds no dependency.
 */
export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  await requireAdmin();

  const params = await searchParams;
  const requested = Number(
    Array.isArray(params.range) ? params.range[0] : params.range,
  );
  const days = RANGES.some((range) => range.days === requested) ? requested : 30;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [rows, settings] = await Promise.all([
    getItemFrequency(since, 100),
    getPublicSettings(),
  ]);

  const peak = rows.reduce((max, row) => Math.max(max, row.unitsSold), 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.unitsSold, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">
          What sells
        </h1>

        <nav className="flex gap-1.5" aria-label="Date range">
          {RANGES.map((range) => (
            <Link
              key={range.days}
              href={`/admin/analytics?range=${range.days}`}
              className={cn(
                "flex min-h-[36px] items-center rounded-full px-3.5 text-sm transition-colors",
                days === range.days
                  ? "bg-accent text-accent-ink"
                  : "bg-surface-1 text-ink-muted hover:bg-surface-2",
              )}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          title="No orders in this period"
          hint="Once customers order, you'll see exactly which dishes move and which don't."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="p-3.5">
              <p className="text-xs tracking-wide text-ink-muted uppercase">
                Dishes sold
              </p>
              <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink">
                {totalUnits}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs tracking-wide text-ink-muted uppercase">
                Different items
              </p>
              <p className="font-display mt-1 text-2xl font-semibold tabular-nums text-ink">
                {rows.length}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs tracking-wide text-ink-muted uppercase">
                Best seller
              </p>
              <p className="font-display mt-1 truncate text-lg font-semibold text-accent-text">
                {rows[0]?.name ?? "—"}
              </p>
            </Card>
          </div>

          <Card className="divide-y divide-[var(--color-line)]">
            {rows.map((row, index) => (
              <div key={row.itemId ?? index} className="px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-sm font-semibold text-ink-faint tabular-nums">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink">
                        {row.name}
                      </p>
                      {!row.itemId && (
                        <Badge tone="neutral">Deleted item</Badge>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint">
                      {row.timesOrdered} order
                      {row.timesOrdered > 1 ? "s" : ""} ·{" "}
                      {timeAgo(row.lastOrderedAt)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-ink">
                      {row.unitsSold}
                    </p>
                    <p className="text-xs text-ink-faint tabular-nums">
                      {formatMoney(row.revenue, settings.currency)}
                    </p>
                  </div>
                </div>

                {/* Proportional bar — instantly shows the drop-off point. */}
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{
                      width: `${peak > 0 ? (row.unitsSold / peak) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
