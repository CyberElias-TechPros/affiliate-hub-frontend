import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  commission: number;
  image: string;
  category?: string;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  onClick?: () => void;
  className?: string;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  ({ id, title, price, commission, image, category, isSaved = false, onSave, onClick, className }, ref) => {
    const [saved, setSaved] = React.useState(isSaved);
    const [imageLoaded, setImageLoaded] = React.useState(false);

    const handleSave = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSaved(!saved);
      onSave?.(id);
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          "group relative bg-card rounded-xl shadow-card overflow-hidden cursor-pointer",
          "transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
          className
        )}
      >
        <div className="flex gap-3 p-3">
          {/* Image Container */}
          <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer bg-[length:400%_100%]" />
            )}
            <img
              src={image}
              alt={title}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                imageLoaded ? "opacity-100" : "opacity-0",
                "group-hover:scale-105"
              )}
            />
            {/* Commission Badge */}
            <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-success text-success-foreground text-xs font-semibold">
              {commission}%
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-1">
            {category && (
              <span className="inline-block text-xs text-muted-foreground font-medium mb-1">
                {category}
              </span>
            )}
            <h3 className="font-semibold text-card-foreground line-clamp-2 leading-snug mb-2">
              {title}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-foreground">
                ₦{price.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={cn(
              "absolute top-3 right-3 p-2 rounded-full transition-all duration-200",
              saved 
                ? "bg-destructive/10 text-destructive" 
                : "bg-card/80 backdrop-blur text-muted-foreground hover:text-destructive"
            )}
          >
            <Heart 
              className={cn(
                "h-4 w-4 transition-transform",
                saved && "fill-current animate-check-bounce"
              )} 
            />
          </button>
        </div>
      </div>
    );
  }
);

ProductCard.displayName = "ProductCard";

export { ProductCard };
