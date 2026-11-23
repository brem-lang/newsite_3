import React, { useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  useAuctionList,
  useBidSummary,
  useRecentBids,
  useSyncAuctions,
  useRefreshAuctionLists,
} from "@/lib/queries/auctions";
import { Timer, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";
import { effectiveStatus, timeRemaining } from "@/lib/auction";
import PullToRefresh from "@/components/PullToRefresh";
import WalletCard from "@/components/home/dashboard/WalletCard";
import MyBidsList from "@/components/home/dashboard/MyBidsList";
import MobileHome from "@/components/home/MobileHome";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { homeHighlights, fill, feedAuctionIds } from "@/lib/homeHighlights";
import RecentActivity from "@/components/home/dashboard/RecentActivity";
import MyAuctionsStrip from "@/components/home/dashboard/MyAuctionsStrip";
import SpotlightHero from "@/components/home/dashboard/SpotlightHero";
import NextStepCard from "@/components/home/dashboard/NextStepCard";
import FillingFast from "@/components/home/dashboard/FillingFast";
import { cn } from "@/lib/utils";

/**
 * Native-style home dashboard: greeting app bar, wallet card, live shelf,
 * my auctions, ending soon and recent activity. Replaces the marketing
 * page as the first screen for signed-in users.
 */
const EMPTY = [];

export default function Dashboard() {
  const { t, dir } = useI18n();
  const { user } = useAuth();
  const { balance, transactions, loading: walletLoading } = useWallet(user?.id, true);
  const isMobile = useIsMobileView();

  // Same cached list and bid summary as the auctions hub: switching between
  // the two pages costs no request while the data is fresh.
  // The route loader waits for both; "loading" covers the bids too because
  // "My auctions" and the counters are built from them.
  const { data: auctions = EMPTY, isPending: auctionsLoading } = useAuctionList(user?.id);
  const { data: bids = EMPTY, isPending: bidsLoading } = useBidSummary(user?.id);
  const loading = auctionsLoading || bidsLoading;
  useSyncAuctions();

  // Live bid feed: newest bids on live auctions with public bids (realtime).
  const feedIds = useMemo(() => feedAuctionIds(auctions), [auctions]);
  const { data: recentBids = EMPTY } = useRecentBids(user?.id, feedIds);
  const auctionsById = useMemo(
    () => Object.fromEntries(auctions.map((a) => [a.id, a])),
    [auctions],
  );
  const reload = useRefreshAuctionLists();

  const myBidByAuction = useMemo(() => {
    const mine = {};
    bids.forEach((b) => {
      if (b.archived || b.user_id !== user?.id) return;
      if (mine[b.auction_id] == null || b.amount > mine[b.auction_id])
        mine[b.auction_id] = b.amount;
    });
    return mine;
  }, [bids, user?.id]);

  const live = useMemo(() => auctions.filter((a) => effectiveStatus(a) === "live"), [auctions]);
  const open = useMemo(() => auctions.filter((a) => effectiveStatus(a) === "open"), [auctions]);

  // Spotlight, "filling fast", the live pulse and the user's next step, all
  // from the same cached rows (src/lib/homeHighlights.js).
  const highlights = useMemo(
    () => homeHighlights(auctions, { userId: user?.id, balance }),
    [auctions, user?.id, balance],
  );
  const { spotlight } = highlights;

  const mine = useMemo(() => {
    return auctions
      .filter((a) => effectiveStatus(a) !== "ended")
      .filter((a) => myBidByAuction[a.id] != null || (a.subscriber_ids || []).includes(user?.id))
      .slice(0, 12)
      .map((a) => ({ auction: a, myBid: myBidByAuction[a.id] ?? null }));
  }, [auctions, myBidByAuction, user?.id]);

  const endingSoon = useMemo(
    // Only clocks that are actually running (a run-out clock is waiting for a new round).
    () =>
      live
        .filter((a) => timeRemaining(a) > 0)
        .sort((a, b) => timeRemaining(a) - timeRemaining(b))
        .slice(0, 12)
        .map((a) => ({ auction: a, myBid: myBidByAuction[a.id] ?? null })),
    [live, myBidByAuction],
  );

  const joined = useMemo(
    () =>
      auctions.filter(
        (a) => effectiveStatus(a) !== "ended" && (a.subscriber_ids || []).includes(user?.id),
      ).length,
    [auctions, user?.id],
  );
  const activeBids = mine.filter((m) => m.myBid != null).length;

  const firstName = (user?.first_name || user?.full_name || user?.email || "").split(/[\s@]/)[0];

  if (isMobile) {
    return (
      <PullToRefresh
        onRefresh={reload}
        dir={dir}
        className="min-h-full overflow-x-clip"
        innerClassName="min-h-full"
      >
        <MobileHome
          auctions={auctions}
          loading={loading}
          authed
          userName={firstName}
          userId={user?.id}
          balance={balance}
          transactions={transactions}
          walletLoading={walletLoading}
          mine={mine}
          wallet={{ balance, joined, activeBids }}
          endingSoon={endingSoon}
          withNav={false}
        />
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh
      onRefresh={reload}
      dir={dir}
      className="min-h-full overflow-x-clip"
      innerClassName="min-h-full"
    >
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 pb-4 lg:max-w-none">
        <header className="flex min-w-0 items-center justify-between gap-3 px-0.5 lg:px-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/45 bg-primary/10 text-primary">
              <Gavel className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {t.dash.greeting}
              </p>
              <h1 className="truncate font-display text-xl font-extrabold leading-tight text-foreground lg:text-[2rem]">
                {firstName || t.brand}
              </h1>
              {/* With a spotlight, the live count is a button inside its card. */}
              <p
                className={cn(
                  "mt-0.5 hidden truncate text-sm text-muted-foreground",
                  !spotlight && "sm:block",
                )}
              >
                {highlights.pulse.live > 1
                  ? fill(t.dash.subLive, { count: highlights.pulse.live })
                  : highlights.pulse.live === 1
                    ? t.dash.subLiveOne
                    : t.dash.subQuiet}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-[10px] font-semibold text-accent sm:hidden">
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </p>
        </header>

        {/* Top row: the spotlight, and beside it the user's balance, the live
            auctions closest to their end, then everything happening right now
            (the activity panel takes the rest of the column's height). With no
            spotlight, the activity panel takes the wide slot instead. */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7">
          {spotlight ? (
            <SpotlightHero
              auction={spotlight}
              userId={user?.id}
              liveLabel={
                highlights.pulse.live > 1
                  ? `${highlights.pulse.live} ${t.dash.pulseLive}`
                  : highlights.pulse.live === 1
                    ? t.dash.subLiveOne.replace(/\.$/, "")
                    : null
              }
            />
          ) : (
            <RecentActivity
              bids={recentBids}
              auctionsById={auctionsById}
              userId={user?.id}
              transactions={transactions}
              walletLoading={walletLoading}
            />
          )}

          <div className="flex min-w-0 flex-col gap-5">
            <WalletCard balance={balance} joined={joined} activeBids={activeBids} />

            {endingSoon.length > 0 ? (
              <section className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive">
                    <Timer className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">
                    {t.dash.endingSoon}
                  </h2>
                </div>
                <MyBidsList items={endingSoon} loading={false} row moving />
              </section>
            ) : null}

            {spotlight ? (
              <RecentActivity
                bids={recentBids}
                auctionsById={auctionsById}
                userId={user?.id}
                transactions={transactions}
                walletLoading={walletLoading}
                fill
                className="lg:flex-1"
              />
            ) : null}
          </div>
        </div>

        {/* Returning users come back for these: right under the top row. */}
        <MyAuctionsStrip items={mine} />

        <NextStepCard step={highlights.nextStep} />

        <FillingFast auctions={highlights.fillingFast} />
      </div>
    </PullToRefresh>
  );
}
