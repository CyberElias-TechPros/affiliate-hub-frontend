import * as React from "react";
import { cn } from "@/lib/utils";

type StatusType = "pending" | "completed" | "failed" | "processing";

interface StatusTagProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; styles: string }> = {
  pending: {
    label: "Pending",
    styles: "bg-pending/10 text-pending border-pending/20",
  },
  processing: {
    label: "Processing",
    styles: "bg-warning/10 text-warning border-warning/20",
  },
  completed: {
    label: "Completed",
    styles: "bg-success/10 text-success border-success/20",
  },
  failed: {
    label: "Failed",
    styles: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const StatusTag = React.forwardRef<HTMLSpanElement, StatusTagProps>(
  ({ status, className }, ref) => {
    const config = statusConfig[status];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
          config.styles,
          className
        )}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5",
          status === "pending" && "bg-pending",
          status === "processing" && "bg-warning animate-pulse-soft",
          status === "completed" && "bg-success",
          status === "failed" && "bg-destructive"
        )} />
        {config.label}
      </span>
    );
  }
);

StatusTag.displayName = "StatusTag";

export { StatusTag };
