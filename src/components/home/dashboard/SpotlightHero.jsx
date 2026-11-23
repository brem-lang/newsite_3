import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Flame, Gavel, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Money } from "@/lib/currency";
import { Image } from "@/components/ui/image";
import LiveCountdown from "@/components/auction/LiveCountdown";
import { effectiveStatus } from "@/lib/auction";
import { seatsOf, seatsLeftOf, fill } from "@/lib/homeHighlights";
import { cn } from "@/lib/utils";

/**
 * The one auction /home leads with: its photo large, the live clock, the
 * price, how many seats are left, and the action that fits this user (join
 * for the entry fee, or go back to the room they already have a seat in).
 * `compact` stacks it for phones.
 */
export default function SpotlightHero({ auction, userId, compact = false, liveLabel = null }) {
  const { t } = useI18n();
  if (!auction) return null;

  const d = t.dash;
  const status = effectiveStatus(auction);
  const live = status === "live";
  const filled = seatsOf(auction);
  const max = Number(auction.max_subscribers || 0);
  const left = seatsLeftOf(auction);
  const pct = Math.min(100, (filled / Math.max(1, max)) * 100);
  const inIt = !!userId && (auction.subscriber_ids || []).includes(userId);
  const fee = Number(auction.entry_fee || 0);

  return (
    <section
      className={cn(
        "group relative flex min-w-0 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card",
        compact ? "min-h-[28rem]" : "min-h-[32rem] lg:min-h-[36rem]"
      )}
      aria-label={d.spotlight}
    >
      <Link
        to="/auction/$id"
        params={{ id: auction.id }}
        // The photo fills the whole card; the details sit on a gradient over
        // its lower half so the photo still shows through behind them.
        className="absolute inset-0 block overflow-hidden bg-muted"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={auction.image_url}
          alt=""
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
          fittingType="fill"
        />
        <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-extrabold text-destructive-foreground">
          {live ? <Flame className="h-3 w-3" /> : null}
          {live ? t.auction.statusLive : t.auction.statusOpen}
        </span>
      </Link>

      <div
        className={cn(
          "pointer-events-none relative flex min-w-0 shrink-0 flex-col bg-gradient-to-t from-card from-35% via-card/80 to-transparent [&_a]:pointer-events-auto",
          compact ? "px-4 pb-4 pt-20" : "px-5 pb-5 pt-28 lg:px-6 lg:pb-6"
        )}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{d.spotlight}</p>
        <Link to="/auction/$id" params={{ id: auction.id }} className="mt-1.5 hover:underline">
          <h2 className={cn("font-display font-extrabold leading-tight text-foreground", compact ? "text-xl" : "text-2xl lg:text-[1.9rem]")}>
            {auction.title}
          </h2>
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background/50 p-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold text-muted-foreground">{t.auction.currentPrice}</p>
            <p className="mt-1 font-display text-2xl font-extrabold leading-none text-primary tabular-nums">
              <Money amount={auction.current_price} codeClassName="text-primary/60" />
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold text-muted-foreground">{live ? d.endsIn : t.auction.seats}</p>
            <p className="mt-1 flex items-center gap-1.5 font-display text-2xl font-extrabold leading-none text-foreground tabular-nums">
              {live ? (
                <>
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <LiveCountdown auction={auction} />
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 shrink-0 text-accent" />
                  {filled}/{max}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Seats: the auction starts when this bar is full. */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="text-muted-foreground">{fill(d.seatsTaken, { filled, max })}</span>
            {!live && left > 0 ? (
              <span className={cn("font-extrabold", left <= 3 ? "text-destructive" : "text-accent")}>
                {left === 1 ? d.seatLeft : fill(d.seatsLeft, { count: left })}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          {!live ? <p className="mt-1.5 text-[11px] text-muted-foreground">{d.startsWhenFull}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to="/auction/$id"
            params={{ id: auction.id }}
            className="gold-button inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition-transform active:scale-[0.98] sm:flex-none"
          >
            <Gavel className="h-4 w-4" />
            {inIt || live || fee <= 0 ? d.enterRoom : fill(d.joinFor, { fee: `${t.common.currency}${fee}` })}
          </Link>
          {inIt ? <span className="text-xs font-bold text-success">{d.youreIn}</span> : null}
          {liveLabel ? (
            <Link
              to="/auctions"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 text-sm font-bold text-foreground backdrop-blur-sm transition-colors hover:bg-destructive/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              {liveLabel}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          ) : !compact ? (
            <Link to="/auctions" className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline">
              {t.home.browse} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
