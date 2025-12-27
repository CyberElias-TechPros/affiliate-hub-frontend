import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownLeft, Filter, ChevronRight } from "lucide-react";
import { BalanceCard } from "@/components/ui/BalanceCard";
import { StatusTag } from "@/components/ui/StatusTag";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/layout/BottomNav";

const transactions = [
  {
    id: "1",
    type: "credit" as const,
    title: "Forex Course Sale",
    amount: 67500,
    date: "Dec 26, 2024",
    status: "completed" as const,
  },
  {
    id: "2",
    type: "debit" as const,
    title: "Withdrawal to GTBank",
    amount: 150000,
    date: "Dec 25, 2024",
    status: "completed" as const,
  },
  {
    id: "3",
    type: "credit" as const,
    title: "Fitness Watch Sale",
    amount: 11250,
    date: "Dec 24, 2024",
    status: "pending" as const,
  },
  {
    id: "4",
    type: "credit" as const,
    title: "Masterclass Sale",
    amount: 37500,
    date: "Dec 23, 2024",
    status: "completed" as const,
  },
  {
    id: "5",
    type: "debit" as const,
    title: "Withdrawal to USDT",
    amount: 50000,
    date: "Dec 22, 2024",
    status: "processing" as const,
  },
];

const WalletPage = () => {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = React.useState(0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 gradient-hero">
        <h1 className="text-2xl font-bold font-display text-foreground mb-6">Wallet</h1>

        {/* Balance Cards Carousel */}
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
            <div className="min-w-full snap-center" onClick={() => setActiveCard(0)}>
              <BalanceCard currency="NGN" balance={472500} trend={12} isActive={activeCard === 0} />
            </div>
            <div className="min-w-full snap-center" onClick={() => setActiveCard(1)}>
              <BalanceCard currency="USD" balance={315} trend={8} isActive={activeCard === 1} />
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
          {transactions.map((tx, index) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 bg-card rounded-xl p-4 shadow-card animate-fade-up cursor-pointer hover:shadow-lg transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
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
                <p className="font-medium text-foreground truncate">{tx.title}</p>
                <p className="text-sm text-muted-foreground">{tx.date}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${tx.type === "credit" ? "text-success" : "text-foreground"}`}>
                  {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toLocaleString()}
                </p>
                <StatusTag status={tx.status} />
              </div>
            </div>
          ))}
        </div>

        <button className="w-full mt-4 py-3 text-primary font-medium flex items-center justify-center">
          View all transactions <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default WalletPage;
