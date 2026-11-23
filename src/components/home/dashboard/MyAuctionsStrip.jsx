import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Gavel, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Image } from "@/components/ui/image";
import LiveCountdown from "@/components/auction/LiveCountdown";
import { effectiveStatus } from "@/lib/auction";
import { seatsOf, seatsLeftOf, fill } from "@/lib/homeHighlights";
import { cn } from "@/lib/utils";
import ScrollRow from "@/components/ui/ScrollRow";

/**
 * The auctions this user is in, as a swipeable row of cards right under the
 * top of /home: photo, live clock (ticking) or seats still to fill, their
 * own bid, and one tap back into the room. Live ones come first. Renders
 * nothing when the user is in no auction (the next-step card covers that).
 */
export default function MyAuctionsStrip({ items = [] }) {
  const { t } = useI18n();
  if (!items.length) return null;
  const d = t.dash;

  const sorted = [...items].sort(
    (a, b) =>
      Number(effectiveStatus(b.auction) === "live") - Number(effectiveStatus(a.auction) === "live"),
  );

  return (
    <section className="min-w-0" aria-label={d.myAuctions}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Gavel className="h-3.5 w-3.5" />
          </span>
          <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">
            {d.myAuctions}{" "}
            <span className="text-muted-foreground tabular-nums">· {items.length}</span>
          </h2>
        </div>
        <Link
          to="/account"
          className="inline-flex items-center gap-0.5 text-xs font-bold text-accent"
        >
          {d.seeAll}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <ScrollRow className="-mx-1 gap-3 px-1 pb-1" label={d.myAuctions}>
        {sorted.map(({ auction, myBid }) => {
          const live = effectiveStatus(auction) === "live";
          const left = seatsLeftOf(auction);
          return (
            <Link
              key={auction.id}
              to="/auction/$id"
              params={{ id: auction.id }}
              className={cn(
                "group relative flex w-[17rem] shrink-0 snap-start overflow-hidden rounded-xl border bg-card transition-[transform,border-color] duration-200 active:scale-[0.98]",
                live
                  ? "border-destructive/40 hover:border-destructive/70"
                  : "border-border hover:border-accent/50",
              )}
            >
              {/* The photo fills the card; the text sits on a fade from the start side. */}
              <div className="absolute inset-0 overflow-hidden bg-muted">
                <Image
                  src={auction.image_url}
                  alt=""
                  className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  fittingType="fill"
                />
              </div>
              {live ? (
                <span className="absolute end-2.5 top-2.5 rounded-full bg-destructive px-2 py-0.5 text-[9px] font-extrabold uppercase text-destructive-foreground">
                  {t.auction.statusLive}
                </span>
              ) : null}
              <div className="photo-fade-side relative min-w-0 flex-1 py-3.5 pe-16 ps-3.5">
                <p className="truncate text-[13px] font-extrabold text-foreground">
                  {auction.title}
                </p>
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs font-bold tabular-nums",
                    live ? "text-primary" : "text-accent",
                  )}
                >
                  {live ? (
                    <>
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <LiveCountdown auction={auction} />
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {left === 1 ? d.seatLeft : fill(d.seatsLeft, { count: left })}
                      <span className="font-semibold text-muted-foreground">
                        · {seatsOf(auction)}/{auction.max_subscribers}
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground tabular-nums">
                  {myBid != null
                    ? `${t.auction.yourBid}: ${t.common.currency}${Number(myBid).toFixed(2)}`
                    : live
                      ? d.noBidYet
                      : d.startsWhenFull}
                </p>
              </div>
            </Link>
          );
        })}
      </ScrollRow>
    </section>
  );
}
