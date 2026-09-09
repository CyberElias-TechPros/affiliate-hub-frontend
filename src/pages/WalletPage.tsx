import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { BalanceCard } from "@/components/ui/BalanceCard";
import { StatusTag } from "@/components/ui/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd } from "@/components/common/AdBanner";
import { DataErrorState, EmptyState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { WalletAPI } from "@/lib/api";
import { formatMoney } from "@shared/api-contract";
import type { Transaction } from "@shared/api-contract";

/**
 * Wallet.
 *
 * Balances and transactions both come from the API. The prototype hardcoded a
 * ₦472,500 balance and five fabricated transactions with December 2024 dates,
 * so the screen looked complete but was entirely fictional.
 *
 * Available and pending are shown separately: a commission that a merchant has
 * not yet approved is not spendable, and conflating the two is how an
 * affiliate ends up requesting a withdrawal that then fails.
 */
const WalletPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);

  const summary = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => WalletAPI.summary() });
  const transactions = useQuery({
    queryKey: ["wallet", "transactions", page],
    queryFn: () => WalletAPI.transactions({ page, pageSize: 10 }),
  });

  const items: Transaction[] = transactions.data?.items ?? [];

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo title="Wallet" description="Your balances and transaction history." path="/wallet" robots="noindex, nofollow" />

      <header className="gradient-hero px-4 pb-2 pt-6">
        <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Wallet</h1>

        {summary.isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : summary.isError ? (
          <DataErrorState
            message="We could not load your balances."
            onRetry={() => void summary.refetch()}
          />
        ) : (
          summary.data && (
            <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
              <div className="min-w-full snap-center">
                <BalanceCard
                  label="Available"
                  currency={summary.data.available.currency}
                  balance={summary.data.available.amountMinor}
                  isActive
                />
              </div>
              <div className="min-w-full snap-center">
                <BalanceCard
                  label="Pending approval"
                  currency={summary.data.pending.currency}
                  balance={summary.data.pending.amountMinor}
                />
              </div>
            </div>
          )
        )}

        {summary.data && (
          <p className="pb-4 text-sm text-muted-foreground">
            Lifetime earnings: <span className="font-medium text-foreground">{formatMoney(summary.data.lifetimeEarnings)}</span>
            {" · "}
            ≈ {formatMoney(summary.data.availableSecondary)} at {summary.data.fxRate.rateScaled / 1_000_000}{" "}
            {summary.data.fxRate.base}/{summary.data.fxRate.quote}
          </p>
        )}
      </header>

      <main id="main-content" className="px-4">
        <div className="py-4">
          <Button
            onClick={() => navigate("/withdraw")}
            disabled={summary.isError || (summary.data?.available.amountMinor ?? 0) <= 0}
            className="gradient-primary h-14 w-full rounded-xl text-lg font-semibold text-primary-foreground shadow-glow"
          >
            <ArrowUpRight className="mr-2 h-5 w-5" />
            Withdraw funds
          </Button>
        </div>

        <section className="py-4" aria-labelledby="transactions-heading">
          <h2 id="transactions-heading" className="mb-4 font-semibold text-foreground">
            Transactions
          </h2>

          {transactions.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : transactions.isError ? (
            <DataErrorState
              message="We could not load your transactions."
              onRetry={() => void transactions.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Your commissions and withdrawals will appear here as soon as you make your first sale."
              action={
                <Button size="sm" variant="outline" onClick={() => navigate("/marketplace")}>
                  Find something to promote
                </Button>
              }
            />
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((tx) => {
                  const isCredit = tx.amount.amountMinor > 0;
                  return (
                    <li
                      key={tx.id}
                      className="bg-card shadow-card flex items-center gap-3 rounded-xl p-4 transition-all hover:shadow-lg"
                    >
                      <span
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                          isCredit ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {isCredit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{tx.description}</span>
                        <span className="block text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>

                      <span className="text-right">
                        <span
                          className={`block font-bold ${isCredit ? "text-success" : "text-foreground"}`}
                        >
                          {isCredit ? "+" : "−"}
                          {formatMoney({
                            amountMinor: Math.abs(tx.amount.amountMinor),
                            currency: tx.amount.currency,
                          })}
                        </span>
                        <StatusTag status={tx.status} />
                      </span>
                    </li>
                  );
                })}
              </ul>

              {transactions.data && transactions.data.totalPages > 1 && (
                <nav className="flex items-center justify-center gap-3 py-6" aria-label="Transaction pages">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Newer
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {transactions.data.page} of {transactions.data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= transactions.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Older
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>

        <div className="flex justify-center py-4">
          <ContentAd />
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default WalletPage;
