import * as React from "react";
import { cn } from "@/lib/utils";

interface CategoryChipProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

const CategoryChip = React.forwardRef<HTMLButtonElement, CategoryChipProps>(
  ({ label, isActive = false, onClick, className }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
          "transition-all duration-200",
          isActive
            ? "gradient-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          className
        )}
      >
        {label}
      </button>
    );
  }
);

CategoryChip.displayName = "CategoryChip";

export { CategoryChip };
