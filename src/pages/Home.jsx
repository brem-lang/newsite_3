import React, { useCallback, useEffect, useState } from "react";
import PullToRefresh from "@/components/PullToRefresh";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useContent } from "@/lib/useContent";
import { useIsMobileView } from "@/lib/useIsMobileView";
import { effectiveStatus } from "@/lib/auction";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHero from "@/components/home/SiteHero";
import HomeStats from "@/components/home/HomeStats";
import HowItWorks from "@/components/home/HowItWorks";
import AuctionsGrid from "@/components/home/AuctionsGrid";
import AboutBlock from "@/components/home/AboutBlock";
import MobileHome from "@/components/home/MobileHome";

export default function Home() {
  const { dir } = useI18n();
  const { content } = useContent();
  const isMobile = useIsMobileView();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const reload = useCallback(() => {
    return base44.entities.Auction.list("-created_date", 50)
      .then(setAuctions)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, [reload]);

  const liveCount = auctions.filter((a) => effectiveStatus(a) === "live").length;
  const seatsFilled = auctions.reduce((s, a) => s + (a.subscriber_ids?.length || 0), 0);
  const topBid = auctions.reduce((m, a) => Math.max(m, a.current_price || 0), 0);

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
          content={content}
          stats={{ liveCount, seatsFilled, topBid }}
        />
      </PullToRefresh>
    );
  }

  return (
    <div className="min-h-screen bg-bidly text-foreground flex flex-col" dir={dir}>
      <SiteHeader />
      <main className="flex-1">
        <SiteHero auctions={auctions} loading={loading} authed={authed} content={content} />
        <HomeStats liveCount={liveCount} seatsFilled={seatsFilled} topBid={topBid} />
        <AuctionsGrid auctions={auctions} loading={loading} />
        <HowItWorks />
        <AboutBlock />
      </main>
      <SiteFooter />
    </div>
  );
}
