import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAuctionList, useRefreshAuctionLists } from "@/lib/queries/auctions";
import PullToRefresh from "@/components/PullToRefresh";
import { useI18n } from "@/lib/i18n";
import { useContent } from "@/lib/useContent";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { effectiveStatus } from "@/lib/auction";
import { isRunningAuction } from "@/lib/homeShowcase";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHero from "@/components/home/SiteHero";
import HomeStats from "@/components/home/HomeStats";
import HowItWorks from "@/components/home/HowItWorks";
import AuctionsGrid from "@/components/home/AuctionsGrid";
import AboutBlock from "@/components/home/AboutBlock";
import MobileHome from "@/components/home/MobileHome";

const EMPTY = [];

// Signed-out visitors get no realtime auction updates, so their list is
// re-read every minute (paused in background tabs) and when they come back
// to the tab: an auction staff end disappears without a reload.
const GUEST_REFRESH = { refetchInterval: 60_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true };
const NO_OPTIONS = {};

export default function Home() {
  const { dir } = useI18n();
  const { content, loading: contentLoading } = useContent();
  const isMobile = useIsMobileView();
  const { user, isAuthenticated: authed } = useAuth();
  const { data: auctions = EMPTY, isPending: loading } = useAuctionList(user?.id, 50, authed ? NO_OPTIONS : GUEST_REFRESH);
  const reload = useRefreshAuctionLists();

  // The stats strip only counts auctions still running (ended rounds don't count).
  const running = auctions.filter(isRunningAuction);
  const liveCount = running.filter((a) => effectiveStatus(a) === "live").length;
  const seatsFilled = running.reduce((s, a) => s + (a.subscriber_ids?.length || 0), 0);
  const topBid = running.reduce((m, a) => Math.max(m, a.current_price || 0), 0);

  if (isMobile) {
    return (
      <PullToRefresh
        onRefresh={reload}
        dir={dir}
        className="h-[100dvh] bg-bidly text-foreground"
        innerClassName="min-h-full"
      >
        <MobileHome
          auctions={auctions}
          loading={loading}
          authed={authed}
          stats={{ liveCount, seatsFilled, topBid }}
        />
      </PullToRefresh>
    );
  }

  return (
    <div className="min-h-screen bg-bidly text-foreground flex flex-col" dir={dir}>
      <SiteHeader />
      <main className="flex-1">
        <SiteHero auctions={auctions} loading={loading} authed={authed} content={content} contentLoading={contentLoading} />
        <HomeStats liveCount={liveCount} seatsFilled={seatsFilled} topBid={topBid} />
        <AuctionsGrid auctions={auctions} loading={loading} />
        <HowItWorks />
        <AboutBlock />
      </main>
      <SiteFooter />
    </div>
  );
}
