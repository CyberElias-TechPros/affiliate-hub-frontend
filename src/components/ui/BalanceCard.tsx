import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, money } from "@shared/api-contract";
import type { Currency } from "@shared/api-contract";

interface BalanceCardProps {
  /** "Available", "Pending approval", … */
  label: string;
  currency: Currency;
  /** Integer minor units, exactly as the API returns them. */
  balance: number;
  isActive?: boolean;
  className?: string;
}

/**
 * Balance display with a privacy toggle.
 *
 * Formatting is delegated to `formatMoney` from the shared contract. The
 * previous version formatted inline with `toLocaleString`, which produced
 * "₦472,500.00" here and "₦472,500" elsewhere in the same app.
 */
export const BalanceCard: React.FC<BalanceCardProps> = ({
  label,
  currency,
  balance,
  isActive = false,
  className,
}) => {
  const [hidden, setHidden] = React.useState(false);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl p-5 transition-all duration-300",
        isActive
          ? "gradient-primary text-primary-foreground shadow-glow"
          : "bg-card text-card-foreground shadow-card",
        className,
      )}
    >
      {isActive && (
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border-2 border-current" />
          <div className="absolute -right-4 top-8 h-24 w-24 rounded-full border-2 border-current" />
        </div>
      )}

      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <span
            className={cn("text-sm font-medium", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className={cn("rounded-full p-1.5 transition-colors", isActive ? "hover:bg-primary-foreground/10" : "hover:bg-muted")}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            aria-pressed={hidden}
          >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <p className="font-display text-3xl font-bold tracking-tight">
          {hidden ? "••••••" : formatMoney(money(balance, currency))}
        </p>
      </div>
    </div>
  );
};
