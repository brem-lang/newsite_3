import React from "react";
import { Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Compact "how many bids do I have here" card.
 * Shows the bids the signed-in user placed in the current round and how many
 * are still left from the per-participant quota (free quota + bought extras).
 */
export default function MyBidsCard({ auction, bidState, className }) {
  const { t } = useI18n();
  const mine = Array.isArray(bidState?.mine) ? bidState.mine : [];
  const used = mine.length;
  const baseQuota = Math.max(0, Number(auction?.bids_per_participant ?? 0));
  const credits = Math.max(0, Number(bidState?.credits || 0));
  const quota = baseQuota ? baseQuota + credits : 0;
  const left = quota ? Math.max(0, quota - used) : null;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Gavel className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">{t.auction.myBidsTitle}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {left === null
                ? t.auction.myBidsHintNoQuota
                : t.auction.myBidsHint.replace("{left}", String(left))}
            </p>
          </div>
        </div>
        <p className="font-display text-xl font-extrabold tabular-nums leading-none text-foreground">
          {used}
          {quota ? <span className="text-xs font-bold text-muted-foreground">/{quota}</span> : null}
        </p>
      </div>
      {quota ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.round((used / quota) * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
