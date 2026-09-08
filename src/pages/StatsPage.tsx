import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, MousePointerClick, Target, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/layout/BottomNav";
import { DataErrorState, EmptyState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { StatsAPI } from "@/lib/api";
import { formatMoney } from "@shared/api-contract";
import type { StatsRange } from "@shared/api-contract";

/**
 * Performance analytics.
 *
 * The prototype rendered from two module-level constants — a fixed `weeklyData`
 * array and a leaderboard whose fourth row was `{ name: "You", earnings: 472500 }`.
 * The chart therefore never moved no matter what the affiliate did.
 *
 * Both now come from the API. The range selector is real: it changes the query
 * key, which refetches, and the backend zero-fills the series so the chart always
 * has one bar per day rather than collapsing on a quiet week.
 */

const RANGES: Array<{ id: StatsRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

const StatsPage = () => {
  const [range, setRange] = React.useState<StatsRange>("30d");

  const stats = useQuery({
    queryKey: ["stats", "dashboard", range],
    queryFn: () => StatsAPI.dashboard(range),
  });
  const leaderboard = useQuery({
    queryKey: ["stats", "leaderboard"],
    queryFn: () => StatsAPI.leaderboard(10),
  });

  const chartData = (stats.data?.series ?? []).map((point) => ({
    // Short labels keep the x-axis readable at 90 points.
    day: new Date(point.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
    Clicks: point.clicks,
    Sales: point.conversions,
  }));

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo
        title="Performance"
        description="Your clicks, conversions and earnings over time."
        path="/stats"
        robots="noindex, nofollow"
      />

      <header className="gradient-hero px-4 pb-4 pt-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Performance</h1>

        <div className="mt-4 flex gap-2" role="group" aria-label="Date range">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              aria-pressed={range === option.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                range === option.id
                  ? "gradient-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <main id="main-content" className="px-4 py-4">
        {stats.isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : stats.isError ? (
          <DataErrorState message="We could not load your stats." onRetry={() => void stats.refetch()} />
        ) : !stats.data ? null : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                icon={MousePointerClick}
                label="Clicks"
                value={stats.data.clicks.toLocaleString("en-NG")}
              />
              <Metric icon={Target} label="Conversions" value={String(stats.data.conversions)} />
              <Metric
                icon={TrendingUp}
                label="Conversion rate"
                value={`${(stats.data.conversionRateBps / 100).toFixed(1)}%`}
              />
              <Metric icon={BarChart3} label="Earnings" value={formatMoney(stats.data.earnings)} tone="success" />
            </div>

            {stats.data.goal && (
              <section className="bg-card shadow-card mt-4 rounded-xl p-4" aria-labelledby="goal-heading">
                <h2 id="goal-heading" className="mb-2 text-sm font-medium text-foreground">
                  Monthly goal
                </h2>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="gradient-primary h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        stats.data.goal.targetMinor > 0
                          ? (stats.data.goal.progressMinor / stats.data.goal.targetMinor) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatMoney({
                    amountMinor: stats.data.goal.progressMinor,
                    currency: stats.data.goal.currency,
                  })}{" "}
                  of{" "}
                  {formatMoney({
                    amountMinor: stats.data.goal.targetMinor,
                    currency: stats.data.goal.currency,
                  })}
                </p>
              </section>
            )}

            <section className="mt-6" aria-labelledby="chart-heading">
              <h2 id="chart-heading" className="font-display mb-3 text-lg font-semibold text-foreground">
                Clicks and sales
              </h2>
              {chartData.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Once your links start getting clicks, the trend will appear here."
                />
              ) : (
                <div className="bg-card shadow-card h-64 rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="Clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Sales" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {stats.data.topProducts.length > 0 && (
              <section className="mt-6" aria-labelledby="top-products-heading">
                <h2 id="top-products-heading" className="font-display mb-3 text-lg font-semibold text-foreground">
                  Best performing products
                </h2>
                <ul className="space-y-2">
                  {stats.data.topProducts.map((product) => (
                    <li key={product.productId} className="bg-card shadow-card rounded-xl p-4">
                      <Link to={`/products/${product.productId}`} className="font-medium text-foreground hover:text-primary">
                        {product.title}
                      </Link>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Clicks</dt>
                          <dd className="font-medium text-foreground">{product.clicks}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Sales</dt>
                          <dd className="font-medium text-foreground">{product.conversions}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Earned</dt>
                          <dd className="font-medium text-success">{formatMoney(product.earnings)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <section className="mt-8" aria-labelledby="leaderboard-heading">
          <h2 id="leaderboard-heading" className="font-display mb-1 text-lg font-semibold text-foreground">
            Leaderboard
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Affiliates are shown by handle, not by name.
          </p>

          {leaderboard.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : leaderboard.isError ? (
            <DataErrorState
              message="We could not load the leaderboard."
              onRetry={() => void leaderboard.refetch()}
            />
          ) : (
            <ol className="space-y-2">
              {(leaderboard.data?.entries ?? []).map((entry) => (
                <li
                  key={entry.rank}
                  className="bg-card shadow-card flex items-center gap-3 rounded-xl p-3"
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-bold ${
                      entry.rank === 1
                        ? "gradient-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{entry.handle}</span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {entry.tier} · {entry.conversions} sale{entry.conversions === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-semibold text-foreground">{formatMoney(entry.earnings)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "success";
}> = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-card shadow-card rounded-xl p-4">
    <Icon className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`font-display text-xl font-bold ${tone === "success" ? "text-success" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

export default StatsPage;
