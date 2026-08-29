import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownLeft, Filter, ChevronRight } from "lucide-react";
import { BalanceCard } from "@/components/ui/BalanceCard";
import { StatusTag } from "@/components/ui/StatusTag";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd, StickyFooterAd } from "@/components/common/AdBanner";
import { WalletAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const WalletPage = () => {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = React.useState(0);

  // Fetch live wallet balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => WalletAPI.getBalance(),
    select: (r) => r.data,
  });

  // Fetch live transaction history
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => WalletAPI.getTransactions({ limit: 20 }),
    select: (r) => r.data,
  });

  const ngnBalance = balance?.ngnBalance ?? 0;
  const usdBalance = balance?.usdBalance ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 gradient-hero">
        <h1 className="text-2xl font-bold font-display text-foreground mb-6">Wallet</h1>

        {/* Balance Cards Carousel */}
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
            <div className="min-w-full snap-center" onClick={() => setActiveCard(0)}>
              {balanceLoading ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
              ) : (
                <BalanceCard currency="NGN" balance={ngnBalance} trend={12} isActive={activeCard === 0} />
              )}
            </div>
            <div className="min-w-full snap-center" onClick={() => setActiveCard(1)}>
              {balanceLoading ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
              ) : (
                <BalanceCard currency="USD" balance={usdBalance} trend={8} isActive={activeCard === 1} />
              )}
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full transition-all ${activeCard === 0 ? "w-6 bg-primary" : "bg-muted"}`} />
            <div className={`w-2 h-2 rounded-full transition-all ${activeCard === 1 ? "w-6 bg-primary" : "bg-muted"}`} />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-4 py-4">
        <Button
          onClick={() => navigate("/withdraw")}
          className="w-full h-14 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow text-lg"
        >
          <ArrowUpRight className="h-5 w-5 mr-2" />
          Withdraw Funds
        </Button>
      </div>

      {/* Transactions */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Transactions</h2>
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        <div className="space-y-3">
          {txLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 bg-card rounded-xl p-4 shadow-card">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-card rounded-xl">
              <div className="text-3xl mb-2">💰</div>
              <p className="font-medium text-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your earnings and withdrawals will appear here.
              </p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 bg-card rounded-xl p-4 shadow-card animate-fade-up cursor-pointer hover:shadow-lg transition-all"
                style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === "credit"
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {tx.type === "credit" ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {tx.description || (tx.type === "credit" ? "Commission" : "Withdrawal")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    }) : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.type === "credit" ? "text-success" : "text-foreground"}`}>
                    {tx.type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString()}
                  </p>
                  <StatusTag status={tx.status} />
                </div>
              </div>
            ))
          )}
        </div>

        <button className="w-full mt-4 py-3 text-primary font-medium flex items-center justify-center">
          View all transactions <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>

      {/* Ad Section */}
      <div className="px-4 py-4">
        <div className="flex justify-center">
          <ContentAd />
        </div>
      </div>

      <BottomNav />
      <StickyFooterAd />
    </div>
  );
};

export default WalletPage;
