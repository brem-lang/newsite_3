import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { effectiveStatus, timeRemaining, formatCountdownRing } from "@/lib/auction";
import { cn } from "@/lib/utils";

/** Rows for auctions the user has a seat or a bid in. */
export default function MyBidsList({ items = [], loading }) {
  const { t, dir } = useI18n();

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/45 p-5 text-center">
        <Gavel className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t.dash.noneMine}</p>
        <Link to="/auctions" className="mt-3 inline-block text-xs font-bold text-primary">
          {t.home.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      {items.map(({ auction, myBid }) => {
        const st = effectiveStatus(auction);
        return (
          <Link
            key={auction.id}
            to={`/auction/${auction.id}`}
            className="tap-44 flex w-full min-w-0 max-w-full items-center gap-3 rounded-xl border border-border/75 bg-card/80 p-3 transition-transform active:scale-[0.99]"
          >
            <span
              className={cn(
                "grid min-w-[3.4rem] shrink-0 place-items-center rounded-xl px-2 py-2 text-center text-[10px] font-extrabold leading-none tabular-nums",
                st === "live" ? "timer-glow text-primary" : "bg-accent/10 text-accent"
              )}
            >
              {st === "live" ? formatCountdownRing(timeRemaining(auction)) : t.auction.statusOpen}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-foreground">{auction.title}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                {myBid != null
                  ? `${t.auction.yourBid}: ${t.common.currency}${Number(myBid).toFixed(2)}`
                  : `${auction.subscriber_ids?.length || 0}/${auction.max_subscribers} ${t.auction.seats}`}
              </span>
            </span>
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground", dir === "rtl" && "rotate-180")} />
          </Link>
        );
      })}
    </div>
  );
}
