import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@shared/api-contract";
import type { Product } from "@shared/api-contract";

interface ProductCardProps {
  product: Product;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * Product row for the marketplace.
 *
 * Money is rendered through `formatMoney` from the shared contract, so the
 * integer kobo value coming off the API is never divided by hand in a
 * component — the source of the prototype's inconsistent ₦ formatting.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSaved = false,
  onToggleSave,
  onClick,
  className,
}) => {
  const commissionPercent = product.commissionBps / 100;

  return (
    <article
      className={cn(
        "bg-card shadow-card group relative flex gap-3 rounded-xl p-3 transition-all duration-200 hover:shadow-lg",
        onClick && "cursor-pointer active:scale-[0.99]",
        className,
      )}
    >
      {/* The whole card is the click target, but it is a real <button> so it
          is keyboard reachable and announced as actionable. */}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 z-10 rounded-xl"
          aria-label={`View ${product.title}`}
        />
      ) : null}

      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden="true">
            📦
          </div>
        )}
      </div>

      <div className="relative z-20 min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{product.title}</p>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{product.summary}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            {commissionPercent % 1 === 0 ? commissionPercent.toFixed(0) : commissionPercent.toFixed(1)}% commission
          </span>
          <span className="text-sm font-medium text-foreground">{formatMoney(product.price)}</span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          You earn <span className="font-semibold text-success">{formatMoney(product.commissionAmount)}</span> per sale
        </p>
      </div>

      {onToggleSave && (
        <button
          type="button"
          onClick={onToggleSave}
          className="relative z-20 h-8 w-8 flex-shrink-0 rounded-full transition-colors hover:bg-muted"
          aria-label={isSaved ? `Remove ${product.title} from saved` : `Save ${product.title}`}
          aria-pressed={isSaved}
        >
          <Heart
            className={cn(
              "mx-auto h-5 w-5 transition-colors",
              isSaved ? "fill-destructive text-destructive" : "text-muted-foreground",
            )}
          />
        </button>
      )}
    </article>
  );
};
