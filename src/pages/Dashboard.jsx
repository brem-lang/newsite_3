import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Flame, Timer, Gavel } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";
import { effectiveStatus, timeRemaining } from "@/lib/auction";
import { selectHomeAuctions } from "@/lib/homeShowcase";
import PullToRefresh from "@/components/PullToRefresh";
import WalletCard from "@/components/home/dashboard/WalletCard";
import LiveCarousel from "@/components/home/dashboard/LiveCarousel";
import MyBidsList from "@/components/home/dashboard/MyBidsList";
import ActivityList from "@/components/home/dashboard/ActivityList";
import MobileHome from "@/components/home/MobileHome";
import { useIsMobileView } from "@/lib/useIsMobileView";

/**
 * Native-style home dashboard: greeting app bar, wallet card, live shelf,
 * my auctions, ending soon and recent activity. Replaces the marketing
 * page as the first screen for signed-in users.
 */
export default function Dashboard() {
  const { t, dir } = useI18n();
  const { user } = useOutletContext();
  const { balance, transactions, loading: walletLoading } = useWallet(user?.id, true);
  const isMobile = useIsMobileView();

  const [auctions, setAuctions] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    return Promise.all([
      base44.entities.Auction.list("-created_date", 100).then((a) => setAuctions(a || [])),
      base44.entities.Bid.listFields("auction_id,user_id,amount,archived", "-created_date", 1000)
        .then((b) => setBids(b || []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    base44.functions.invoke("syncAuctions").then(() => reload()).catch(() => {});
  }, [reload]);

  const myBidByAuction = useMemo(() => {
    const mine = {};
    bids.forEach((b) => {
      if (b.archived || b.user_id !== user?.id) return;
      if (mine[b.auction_id] == null || b.amount > mine[b.auction_id]) mine[b.auction_id] = b.amount;
    });
    return mine;
  }, [bids, user?.id]);

  const live = useMemo(() => auctions.filter((a) => effectiveStatus(a) === "live"), [auctions]);
  const open = useMemo(() => auctions.filter((a) => effectiveStatus(a) === "open"), [auctions]);

  const featured = useMemo(() => {
    return selectHomeAuctions(auctions);
  }, [auctions]);

  const mine = useMemo(() => {
    return auctions
      .filter((a) => effectiveStatus(a) !== "ended")
      .filter((a) => myBidByAuction[a.id] != null || (a.subscriber_ids || []).includes(user?.id))
      .slice(0, 5)
      .map((a) => ({ auction: a, myBid: myBidByAuction[a.id] ?? null }));
  }, [auctions, myBidByAuction, user?.id]);

  const endingSoon = useMemo(
    () => [...live].sort((a, b) => timeRemaining(a) - timeRemaining(b)).slice(0, 4).map((a) => ({ auction: a, myBid: myBidByAuction[a.id] ?? null })),
    [live, myBidByAuction]
  );

  const joined = useMemo(
    () => auctions.filter((a) => effectiveStatus(a) !== "ended" && (a.subscriber_ids || []).includes(user?.id)).length,
    [auctions, user?.id]
  );
  const activeBids = mine.filter((m) => m.myBid != null).length;

  const firstName = (user?.first_name || user?.full_name || user?.email || "").split(/[\s@]/)[0];

  if (isMobile) {
    return (
      <PullToRefresh onRefresh={reload} dir={dir} className="min-h-full overflow-x-clip" innerClassName="min-h-full">
        <MobileHome auctions={auctions} loading={loading} authed userName={firstName} withNav={false} />
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={reload} dir={dir} className="min-h-full overflow-x-clip" innerClassName="min-h-full">
       <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 pb-4 lg:max-w-none">
         <header className="flex min-w-0 items-center justify-between gap-3 px-0.5 lg:px-0">
           <div className="flex min-w-0 items-center gap-3">
             <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/45 bg-primary/10 text-primary shadow-[0_0_22px_hsl(var(--primary)/0.18)]">
               <Gavel className="h-5 w-5" />
             </span>
             <div className="min-w-0">
               <p className="truncate text-[11px] font-semibold text-muted-foreground">{t.dash.greeting}</p>
               <h1 className="truncate font-display text-xl font-extrabold leading-tight text-foreground lg:text-[2rem]">
                 {firstName || t.brand}
               </h1>
             </div>
           </div>
           <p className="shrink-0 text-[10px] font-semibold text-accent sm:hidden">
             {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
           </p>
         </header>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-7">
          <div className="min-w-0 space-y-5 lg:space-y-7">

            <div className="lg:hidden">
              <WalletCard balance={balance} joined={joined} activeBids={activeBids} />
            </div>

            <LiveCarousel
              title={t.dash.liveNow}
              auctions={featured}
              loading={loading}
              to="/auctions"
            />

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-2">
              <section className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Gavel className="h-3.5 w-3.5" /></span>
                  <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">
                    {t.dash.myAuctions}
                  </h2>
                </div>
                <MyBidsList items={mine} loading={loading} />
              </section>

              {endingSoon.length > 0 ? (
                <section className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive"><Timer className="h-3.5 w-3.5" /></span>
                    <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">
                      {t.dash.endingSoon}
                    </h2>
                  </div>
                  <MyBidsList items={endingSoon} loading={false} />
                </section>
              ) : null}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="hidden lg:block">
              <WalletCard balance={balance} joined={joined} activeBids={activeBids} />
            </div>

            <section>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-amber-500" />
                  <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">
                    {t.dash.activity}
                  </h2>
                </div>
                <Link to="/wallet" className="text-xs font-bold text-primary hover:underline active:opacity-70">
                  {t.dash.seeAll}
                </Link>
              </div>
              <ActivityList transactions={transactions} loading={walletLoading} />
            </section>
          </aside>
        </div>
      </div>
    </PullToRefresh>
  );
}
