import React from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import { ArrowLeft, Trophy, Receipt, Wallet, Gavel, Ban, Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Money } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import { isClosestMode } from "@/lib/auction";

function maskName(id, names) {
  const name = names?.[id];
  if (name) return name;
  return `#${String(id || "").slice(-4)}`;
}

/**
 * Screen 07 — auction results.
 * Shows the closed auction, every bid that was placed, the winner and the
 * payout / payment action that leads into the wallet.
 */
const route = getRouteApi("/_app/auction/$id/results");
const EMPTY = [];

export default function AuctionResults() {
  const { id } = route.useParams();
  const { t, dir } = useI18n();
  const { user: me } = useAuth();
  // The auction row is the same cache entry the auction room uses.
  const { data: auction, isPending: loading, error } = useQuery(auctionQueries.detail(id));
  const { data: bids = EMPTY, isPending: bidsLoading } = useQuery(bidQueries.allForAuction(id));
  const { data: bidState } = useQuery(auctionQueries.bidState(id));
  const { data: payment = null } = useQuery(auctionQueries.winnerPayment(id));
  const names = bidState?.names || {};

  const copy = {
        title: "Auction results",
        winner: "Winner",
        noWinner: "No winner",
        winningBid: "Winning bid",
        allBids: "All bids",
        empty: "No bids were placed",
        cancelled: "Cancelled",
        payout: "Wallet",
        payNow: "Complete payment",
        amountDue: "Amount due",
        paid: "Paid",
        target: "Target price",
        back: "Back",
        bidsCount: "Bids",
      };

  if (!loading && error) throw error;
  // The route loader waits for the auction and its bids; this only happens if
  // the cache was dropped mid-visit.
  if (loading || !auction || bidsLoading) return null;

  const closest = isClosestMode(auction);
  const iWon = auction.winner_id && me?.id === auction.winner_id;
  const sorted = [...bids].sort((a, b) => {
    if (closest) {
      const target = Number(auction.target_price || 0);
      return Math.abs(Number(a.amount) - target) - Math.abs(Number(b.amount) - target);
    }
    return Number(b.amount) - Number(a.amount);
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24" dir={dir}>
      <div className="flex items-center gap-3">
        <Link
          to="/auction/$id"
          params={{ id: auction.id }}
          aria-label={copy.back}
          className="tap-44 grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground"
        >
          <ArrowLeft className={cn("h-5 w-5")} />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{copy.title}</p>
          <h1 className="truncate font-display text-xl font-extrabold text-foreground">{auction.title}</h1>
        </div>
      </div>

      <div className="native-panel overflow-hidden rounded-2xl">
        <div className="relative h-40 bg-muted">
          <Image src={auction.image_url} alt={auction.title} className="h-full w-full" fittingType="fill" />
          <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="p-4">
          {auction.winner_id ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/10 p-3 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Trophy className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{copy.winner}</p>
                <p className="truncate font-display text-lg font-extrabold text-foreground">
                  {auction.winner_name || maskName(auction.winner_id, names)}
                </p>
              </div>
              <div className="ms-auto text-end">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{copy.winningBid}</p>
                <Money amount={auction.current_price} className="font-display text-xl font-extrabold text-primary" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-muted-foreground">
              <Ban className="h-5 w-5" /> <span className="font-bold">{copy.noWinner}</span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
              <p className="text-[10px] font-bold uppercase text-accent">{closest ? copy.target : copy.bidsCount}</p>
              <p className="mt-1 font-display text-lg font-extrabold text-foreground tabular-nums">
                {closest ? <Money amount={auction.target_price} /> : bids.length}
              </p>
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
              <p className="text-[10px] font-bold uppercase text-accent">{payment ? copy.amountDue : copy.bidsCount}</p>
              <p className="mt-1 font-display text-lg font-extrabold text-foreground tabular-nums">
                {payment ? <Money amount={payment.amount} /> : bids.length}
              </p>
            </div>
          </div>

          {iWon && payment && payment.status !== "paid" ? (
            <Button asChild className="gold-button mt-3 h-12 w-full gap-2 rounded-xl font-bold">
              <Link {...(payment.token ? { to: "/pay/$token", params: { token: payment.token } } : { to: "/wallet" })}>
                <Receipt className="h-4 w-4" /> {copy.payNow}
              </Link>
            </Button>
          ) : null}

          <Button asChild variant="outline" className="cyan-button mt-2 h-11 w-full gap-2 rounded-xl font-bold">
            <Link to="/wallet">
              <Wallet className="h-4 w-4" /> {copy.payout}
            </Link>
          </Button>
        </div>
      </div>

      <section className="native-panel rounded-2xl p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Gavel className="h-4 w-4 text-primary" /> {copy.allBids}
          <span className="text-muted-foreground">({bids.length})</span>
        </h2>
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((b, i) => {
              const isWinning = auction.winner_id && b.user_id === auction.winner_id
                && Number(b.amount) === Number(auction.current_price);
              return (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold",
                    isWinning ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {isWinning ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">
                      {maskName(b.user_id, names)}
                      {b.user_id === me?.id ? <span className="ms-1 text-accent">({t.common?.you || "you"})</span> : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(b.created_date).toLocaleString("en-GB")}
                    </p>
                  </div>
                  {b.burned ? (
                    <span className="rounded-md bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive">{copy.cancelled}</span>
                  ) : null}
                  <Money
                    amount={b.amount}
                    className={cn("font-display text-base font-extrabold tabular-nums", isWinning ? "text-primary" : "text-foreground")}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
