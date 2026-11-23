import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { effectiveStatus } from "@/lib/auction";
import LiveCountdown from "@/components/auction/LiveCountdown";
import { cn } from "@/lib/utils";
import ScrollRow from "@/components/ui/ScrollRow";

/**
 * Rows for auctions the user has a seat or a bid in. `row` lays them out as
 * one swipeable line of cards instead of a stack, so a long list never makes
 * the section taller. `moving` (with `row`) makes that line drift along on
 * its own and loop, pausing while the pointer or a finger is on it.
 */
export default function MyBidsList({ items = [], loading, row = false, moving = false }) {
  const { t } = useI18n();

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

  // A swipe row (no arrow buttons) or a plain stack.
  const Wrap = row ? ScrollRow : "div";
  const loop = row && moving && items.length > 1;
  const wrapProps = row ? { className: "-mx-1 gap-2 px-1 pb-1", autoplay: loop, arrows: false } : { className: "min-w-0 space-y-2" };
  // A moving row shows the list twice so it can loop without a jump; the
  // second copy is hidden from screen readers and the keyboard.
  const list = loop
    ? [...items.map((x) => [x, false]), ...items.map((x) => [x, true])]
    : items.map((x) => [x, false]);

  return (
    <Wrap {...wrapProps}>
      {list.map(([{ auction, myBid }, clone], i) => {
        const st = effectiveStatus(auction);
        return (
          <Link
            key={(clone ? "c-" : "") + auction.id}
            to="/auction/$id" params={{ id: auction.id }}
            {...(clone ? { "aria-hidden": true, tabIndex: -1 } : {})}
            {...(clone && i === items.length ? { "data-loop-start": "" } : {})}
            className={cn(
              "tap-44 flex min-w-0 items-center gap-3 rounded-xl border border-border/75 bg-card/80 p-3 transition-transform active:scale-[0.99]",
              row && items.length > 1 ? "w-60 shrink-0 snap-start" : "w-full max-w-full"
            )}
          >
            <span
              className={cn(
                "grid min-w-[3.4rem] shrink-0 place-items-center rounded-xl px-2 py-2 text-center text-[10px] font-extrabold leading-none tabular-nums",
                st === "live" ? "timer-glow text-primary" : "bg-accent/10 text-accent"
              )}
            >
              {/* Ticks every second (shared clock); it used to be computed once. */}
              <LiveCountdown auction={auction} fallback={t.auction.statusOpen} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-foreground">{auction.title}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                {myBid != null
                  ? `${t.auction.yourBid}: ${t.common.currency}${Number(myBid).toFixed(2)}`
                  : `${auction.subscriber_ids?.length || 0}/${auction.max_subscribers} ${t.auction.seats}`}
              </span>
            </span>
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground")} />
          </Link>
        );
      })}
    </Wrap>
  );
}
