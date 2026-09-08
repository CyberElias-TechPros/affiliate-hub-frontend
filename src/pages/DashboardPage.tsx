import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Link2, MousePointerClick, Target, TrendingUp, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd } from "@/components/common/AdBanner";
import { DataErrorState, EmptyState } from "@/components/routing/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Seo } from "@/components/seo/Seo";
import { StatsAPI } from "@/lib/api";
import { formatMoney, money } from "@shared/api-contract";

/**
 * Performance dashboard.
 *
 * Every figure here comes from `/stats/dashboard`, which derives it from real
 * click and conversion rows. The prototype hardcoded "Chinedu 👋", a
 * ₦472,500 balance, a 94.5% goal bar and a fixed weekly chart — none of which
 * changed no matter who signed in.
 */
const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const stats = useQuery({
    queryKey: ["stats", "dashboard", "30d"],
    queryFn: () => StatsAPI.dashboard("30d"),
  });

  const leaderboard = useQuery({
    queryKey: ["stats", "leaderboard"],
    queryFn: () => StatsAPI.leaderboard(5),
  });

  const firstName = user?.name.split(" ")[0] ?? "there";
  const data = stats.data;
  const currency = (data?.earnings.currency ?? "NGN") as "NGN" | "USD";
  const goal = data?.goal;
  const goalPct = goal ? Math.min(100, (goal.progressMinor / goal.targetMinor) * 100) : 0;
  const maxClicks = Math.max(1, ...(data?.series.map((d) => d.clicks) ?? [1]));

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo title="Dashboard" description="Your affiliate performance." path="/dashboard" robots="noindex, nofollow" />

      <header className="gradient-hero px-4 pb-6 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="font-display text-xl font-bold text-foreground">{firstName} 👋</h1>
          </div>
          <Link
            to="/wallet"
            className="rounded-full bg-card p-2 shadow-sm"
            aria-label="Open your wallet"
          >
            <Zap className="h-5 w-5 text-accent" />
          </Link>
        </div>

        {stats.isLoading ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : stats.isError ? (
          <DataErrorState
            message="We could not load your performance summary."
            onRetry={() => void stats.refetch()}
          />
        ) : (
          <div className="gradient-primary rounded-2xl p-5 text-primary-foreground shadow-glow">
            <p className="text-sm text-primary-foreground/80">Available to withdraw</p>
            <p className="font-display mt-1 text-3xl font-bold tracking-tight">
              {formatMoney(data?.earnings ?? money(0, currency))}
            </p>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Earned in the last 30 days · {data?.conversions ?? 0} approved sales
            </p>
          </div>
        )}
      </header>

      <main id="main-content" className="px-4">
        {stats.isError ? null : (
          <div className="grid grid-cols-3 gap-3 py-4">
            <MetricCard
              label="Clicks"
              value={String(data?.clicks ?? 0)}
              icon={MousePointerClick}
              tone="primary"
            />
            <MetricCard
              label="Sales"
              value={String(data?.conversions ?? 0)}
              icon={TrendingUp}
              tone="success"
            />
            <MetricCard
              label="Conv. rate"
              value={`${(((data?.conversionRateBps ?? 0) / 100).toFixed(1))}%`}
              icon={Target}
              tone="accent"
            />
          </div>
        )}

        {/* Weekly clicks, zero-filled so a day with no traffic still appears.
            Summing only non-empty days would make the x-axis lie. */}
        <section className="py-4" aria-labelledby="weekly-heading">
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="weekly-heading" className="font-semibold text-foreground">
                Daily clicks
              </h2>
              <span className="text-xs text-muted-foreground">Last {data?.series.length ?? 0} days</span>
            </div>

            {stats.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !data || data.clicks === 0 ? (
              <EmptyState
                title="No clicks yet"
                description="Generate a link for a product and share it — your clicks will show up here."
                action={
                  <Button size="sm" onClick={() => navigate("/marketplace")}>
                    Find a product
                  </Button>
                }
              />
            ) : (
              <div
                className="flex h-32 items-end justify-between gap-1.5"
                role="img"
                aria-label={`Daily clicks over the last ${data.series.length} days, peaking at ${maxClicks}`}
              >
                {data.series.map((day) => {
                  const height = (day.clicks / maxClicks) * 100;
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="relative w-full" style={{ height: `${Math.max(2, height)}%` }}>
                        <div
                          className="gradient-primary h-full w-full rounded-t-md"
                          title={`${day.clicks} clicks on ${day.date}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(day.date).toLocaleDateString("en-NG", { weekday: "narrow" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Top products */}
        <section className="py-4" aria-labelledby="top-products-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="top-products-heading" className="font-semibold text-foreground">
              Top performers
            </h2>
            <Link to="/stats" className="flex items-center text-sm font-medium text-primary">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {stats.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : data && data.topProducts.length > 0 ? (
            <div className="space-y-3">
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="bg-card flex items-center gap-3 rounded-xl p-3 shadow-card">
                  <div className="gradient-primary flex h-10 w-10 items-center justify-center rounded-xl font-bold text-primary-foreground">
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{product.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.conversions} sale{product.conversions === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-bold text-success">{formatMoney(product.earnings)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No sales yet" description="Your best-performing products will appear here." />
          )}
        </section>

        {/* Goal */}
        {goal && (
          <section className="py-4" aria-labelledby="goal-heading">
            <div className="bg-card rounded-xl p-4 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="goal-heading" className="font-semibold text-foreground">
                  Monthly goal
                </h2>
                <Link to="/settings" className="text-sm font-medium text-primary">
                  Edit
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-foreground">
                    {formatMoney(money(goal.progressMinor, goal.currency))} of{" "}
                    {formatMoney(money(goal.targetMinor, goal.currency))}
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(goalPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress towards your monthly goal"
                >
                  <div
                    className="gradient-primary h-2 rounded-full transition-[width] duration-500"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {goal.progressMinor >= goal.targetMinor
                    ? "Goal reached. Set a bigger one."
                    : `${formatMoney(money(goal.targetMinor - goal.progressMinor, goal.currency))} to go`}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Leaderboard — handles are pseudonymised server-side. */}
        {leaderboard.data && leaderboard.data.entries.length > 0 && (
          <section className="py-4" aria-labelledby="leaderboard-heading">
            <h2 id="leaderboard-heading" className="mb-3 font-semibold text-foreground">
              Top affiliates this month
            </h2>
            <div className="bg-card rounded-xl p-4 shadow-card">
              <ol className="space-y-3">
                {leaderboard.data.entries.map((entry) => (
                  <li key={`${entry.rank}-${entry.handle}`} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        entry.rank === 1 ? "gradient-gold text-accent-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <span className="flex-1 font-medium text-foreground">{entry.handle}</span>
                    <span className="font-bold text-success">{formatMoney(entry.earnings)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <div className="flex justify-center py-4">
          <ContentAd />
        </div>

        <div className="py-4">
          <button
            type="button"
            onClick={() => navigate("/marketplace")}
            className="gradient-gold flex w-full items-center justify-between rounded-xl p-4 text-left shadow-lg"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Link2 className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">Find new products</span>
                <span className="block text-sm opacity-80">Explore high-commission offers</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "accent";
}> = ({ label, value, icon: Icon, tone }) => (
  <div className="bg-card animate-fade-in rounded-xl p-3 shadow-card">
    <div
      className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
        tone === "primary"
          ? "bg-primary/10 text-primary"
          : tone === "success"
            ? "bg-success/10 text-success"
            : "bg-accent/10 text-accent"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default DashboardPage;
