import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  className?: string;
}

const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ icon, title, subtitle, value, rightElement, showArrow = true, destructive = false, onClick, className }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200",
          "hover:bg-muted/50 active:scale-[0.99]",
          destructive && "text-destructive hover:bg-destructive/5",
          className
        )}
      >
        {icon && (
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
            destructive 
              ? "bg-destructive/10 text-destructive" 
              : "bg-primary/10 text-primary"
          )}>
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium",
            destructive ? "text-destructive" : "text-foreground"
          )}>
            {title}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {value && (
          <span className="text-sm text-muted-foreground">{value}</span>
        )}

        {rightElement}

        {showArrow && !rightElement && (
          <ChevronRight className={cn(
            "h-5 w-5 flex-shrink-0 transition-transform",
            destructive ? "text-destructive/60" : "text-muted-foreground"
          )} />
        )}
      </div>
    );
  }
);

MenuItem.displayName = "MenuItem";

export { MenuItem };
