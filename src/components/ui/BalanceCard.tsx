import * as React from "react";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  currency: "NGN" | "USD";
  balance: number;
  trend?: number;
  isActive?: boolean;
  className?: string;
}

const BalanceCard = React.forwardRef<HTMLDivElement, BalanceCardProps>(
  ({ currency, balance, trend, isActive = false, className }, ref) => {
    const [hidden, setHidden] = React.useState(false);

    const formatBalance = (amount: number) => {
      if (hidden) return "••••••";
      const prefix = currency === "NGN" ? "₦" : "$";
      return `${prefix}${amount.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full p-5 rounded-2xl overflow-hidden transition-all duration-300",
          isActive 
            ? "gradient-primary text-primary-foreground shadow-glow" 
            : "bg-card text-card-foreground shadow-card",
          className
        )}
      >
        {/* Background Pattern */}
        {isActive && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-2 border-current" />
            <div className="absolute -right-4 top-8 w-24 h-24 rounded-full border-2 border-current" />
          </div>
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className={cn(
              "text-sm font-medium",
              isActive ? "text-primary-foreground/80" : "text-muted-foreground"
            )}>
              {currency === "NGN" ? "Nigerian Naira" : "US Dollar"}
            </span>
            <button
              onClick={() => setHidden(!hidden)}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                isActive 
                  ? "hover:bg-primary-foreground/10" 
                  : "hover:bg-muted"
              )}
            >
              {hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-3xl font-bold font-display tracking-tight">
              {formatBalance(balance)}
            </p>
            {trend !== undefined && (
              <div className={cn(
                "inline-flex items-center gap-1 text-sm font-medium",
                trend >= 0 
                  ? isActive ? "text-primary-foreground" : "text-success" 
                  : "text-destructive"
              )}>
                <TrendingUp className={cn("h-3.5 w-3.5", trend < 0 && "rotate-180")} />
                <span>{trend >= 0 ? "+" : ""}{trend}% this week</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

BalanceCard.displayName = "BalanceCard";

export { BalanceCard };
