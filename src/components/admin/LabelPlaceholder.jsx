import React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline stand-in for a name (user, auction, transaction) whose lookup is still
 * loading, so a table cell doesn't show a raw id that turns into a name a
 * moment later. Pair with isLabelLoading(map, id) from @/lib/queries/admin.
 */
export default function LabelPlaceholder({ className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-3 w-20 max-w-full animate-pulse rounded bg-muted align-middle",
        className,
      )}
    />
  );
}
