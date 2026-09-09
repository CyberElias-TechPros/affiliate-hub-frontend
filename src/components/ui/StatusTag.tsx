import * as React from "react";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@shared/api-contract";

/**
 * Status pill.
 *
 * Keyed off the shared `TransactionStatus` union, so adding a status to the
 * contract without handling it here is a compile error rather than a pill that
 * silently renders with no styling.
 */
const STYLES: Record<TransactionStatus, string> = {
  pending: "bg-pending/10 text-pending",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const StatusTag: React.FC<{ status: TransactionStatus; className?: string }> = ({
  status,
  className,
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      STYLES[status],
      className,
    )}
  >
    {LABELS[status]}
  </span>
);
