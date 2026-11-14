import React from "react";
import { Crown, Flame, ChevronDown, Flame as Burn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buildLeaderboard } from "@/lib/leaderboard";
import { formatDateTime } from "@/lib/format";

const RANK_STYLES = [
  "bg-warning text-warning-foreground",
  "bg-muted text-muted-foreground",
  "bg-accent text-accent-foreground"
];

export default function Leaderboard({
  bids,
  currentUserId,
  live,
  closest = false,
  target = 0,
  names = {},
  allBids = null,
}) {
  const { t } = useI18n();
  const { rows, reveal, streak } = buildLeaderboard({ bids, currentUserId, live, closest, target });
  const [showAll, setShowAll] = React.useState(false);
  const log = Array.isArray(allBids) ? allBids : [];
  const nameOf = (id) => (id === currentUserId ? t.auction.you : (names?.[id] || t.auction.bidder || "Bidder"));

  return (
    <div className="overflow-hidden">
      <div className="py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <Crown className="h-4 w-4" />
          </span>
          <h2 className="min-w-0 truncate font-display text-base font-bold text-foreground">{t.auction.leaderboard}</h2>
          {live && (
            <span className="ms-auto inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> {t.street.live}
            </span>
          )}
        </div>
        {(streak > 1 || rows.length > 0) && (
          <div className="mt-2 flex flex-nowrap items-center gap-1.5 overflow-hidden">
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Top 5</span>
            {closest && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {reveal ? t.auction.closestRevealed : t.auction.closestSealedHint}
              </span>
            )}
            {streak > 1 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                <Flame className="w-3 h-3" /> {streak} {t.auction.streak}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t.auction.noBids}</div>
        ) : rows.map((r, i) => {
          const isYou = r.isYou;
          const first = i === 0;
          const rankStyle = RANK_STYLES[i] || "bg-muted text-muted-foreground";
          return (
            <div key={r.userId} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-3", first ? "border-primary/35 bg-primary/8 shadow-[0_0_18px_hsl(var(--primary)/0.08)]" : "border-border bg-card")}>
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <span className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-full grid place-items-center text-xs font-bold shrink-0", rankStyle)}>
                  {first ? <Crown className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span className={cn("min-w-0 truncate text-sm text-foreground", isYou && "font-bold text-primary")}> 
                  {nameOf(r.userId)}
                </span>
              </div>
              <div className="text-end shrink-0">
                {r.masked ? (
                  <span className="text-sm font-bold text-muted-foreground tabular-nums">••••</span>
                ) : (
                   <span className={cn("block text-sm font-bold tabular-nums", first ? "text-primary" : "text-foreground")}>{t.common.currency}{r.amount.toFixed(2)}</span>
                )}
                {closest && !r.masked && (
                  <span className="block text-[10px] font-semibold text-muted-foreground tabular-nums">
                    {t.auction.closestGap}: {t.common.currency}{r.gap.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {log.length > 0 && (
        <div className="mt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAll((s) => !s)}
            className="h-11 w-full justify-between px-1 text-xs font-bold text-primary"
          >
            <span>
              {(t.auction.showAllBids || "Show all bids ({count})").replace("{count}", String(log.length))}
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showAll && "rotate-180")} />
          </Button>
          {showAll && (
            <div className="divide-y divide-border">
              {log.map((b, i) => (
                <div key={`${b.user_id}-${b.created_date}-${i}`} className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2">
                  <div className="min-w-0">
                    <p className={cn("truncate text-sm", b.user_id === currentUserId ? "font-bold text-primary" : "text-foreground")}> 
                      {nameOf(b.user_id)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(b.created_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.burned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                        <Burn className="w-3 h-3" /> {t.auction.poolBurnedShort || "Burned"}
                      </span>
                    )}
                    <span className={cn("text-sm font-bold tabular-nums", b.burned ? "text-accent line-through" : "text-foreground")}> 
                      {b.amount == null ? "••••" : `${t.common.currency}${Number(b.amount).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
