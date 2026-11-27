import React from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marks a row made by Admin → Test mode (auctions.is_test), so staff never
 * mistake a test win or payment for a real one. Renders nothing otherwise.
 */
export default function TestBadge({ show, className }) {
  if (!show) return null;
  return (
    <span
      title="Created by Test mode. Not shown to members and not counted in reports."
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-warning",
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Test
    </span>
  );
}
