import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Gavel } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { effectiveStatus } from "@/lib/auction";
import DashboardStrip from "@/components/auctions/DashboardStrip";
import AuctionFilters from "@/components/auctions/AuctionFilters";
import AuctionCard from "@/components/AuctionCard";
import FeaturedAuctionHero from "@/components/auctions/FeaturedAuctionHero";
import MobileAuctionsHub from "@/components/auctions/MobileAuctionsHub";
import { useIsMobileView } from "@/lib/useIsMobileView";

export default function Auctions() {
  const { t } = useI18n();
  const { user, walletBalance } = useOutletContext();
  const h = t.hub;
  const [searchParams, setSearchParams] = useSearchParams();
  const [auctions, setAuctions] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobileView = useIsMobileView();

  const tab = searchParams.get("tab") || "all";
  const sort = searchParams.get("sort") || "newest";
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";

  const reload = useCallback(() => {
    setLoading(true);
    return base44.entities.Auction.list("-created_date", 200)
      .then((a) => setAuctions(a || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    // The listings render as soon as auctions arrive; bid counts stream in
    // separately so the grid is never blocked by the heavier bid history.
    reload();
    base44.entities.Bid.listFields("auction_id,user_id,amount,archived", "-created_date", 1000)
      .then((b) => { if (active) setBids(b || []); })
      .catch(() => {});
    // Advance every auction's clock (start due rounds, end expired ones and
    // reopen the last ended auction when nothing is running), then refresh.
    base44.functions
      .invoke("syncAuctions")
      .then(() => { if (active) reload(); })
      .catch(() => {});
    return () => { active = false; };
  }, [reload]);



  // Lock page scroll while the no-scroll mobile hub is shown.
  useEffect(() => {
    if (!isMobileView) return;
    const html = document.documentElement;
    const body = document.body;
    const prevH = html.style.overflow;
    const prevB = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevH;
      body.style.overflow = prevB;
    };
  }, [isMobileView]);

  const bidsByAuction = useMemo(() => {
    const total = {};
    const mine = {};
    bids.forEach((b) => {
      if (b.archived) return; // bids from a previous round live in the archive
      total[b.auction_id] = (total[b.auction_id] || 0) + 1;
      if (b.user_id === user?.id) {
        if (mine[b.auction_id] == null || b.amount > mine[b.auction_id]) mine[b.auction_id] = b.amount;
      }
    });
    return { total, mine };
  }, [bids, user?.id]);

  // "My bids" covers every auction the user is part of: seats they bought and
  // auctions they already bid in.
  const isMineAuction = useCallback(
    (a) => bidsByAuction.mine[a.id] != null || (a.subscriber_ids || []).includes(user?.id),
    [bidsByAuction, user?.id]
  );

  const stats = useMemo(() => {
    let activeBids = 0;
    let wins = 0;
    let joined = 0;
    const mineIds = new Set(Object.keys(bidsByAuction.mine));
    auctions.forEach((a) => {
      const st = effectiveStatus(a);
      if (mineIds.has(a.id) && st !== "ended") activeBids++;
      if (a.winner_id === user?.id) wins++;
      if ((a.subscriber_ids || []).includes(user?.id) && st !== "ended") joined++;
    });
    return { activeBids, wins, joined };
  }, [auctions, bidsByAuction, user?.id]);

  const featured = useMemo(() => {
    return auctions.find((a) => effectiveStatus(a) === "live")
      || auctions.find((a) => effectiveStatus(a) === "open")
      || null;
  }, [auctions]);

  const counts = useMemo(() => {
    // Only count auctions that still exist in the list, so the tab badge can
    // never promise more rows than the tab can show.
    const c = { all: 0, live: 0, open: 0, ended: 0, mine: 0 };
    auctions.forEach((a) => {
      const st = effectiveStatus(a);
      if (isMineAuction(a)) c.mine++;
      if (st === "live") c.live++;
      else if (st === "open") c.open++;
      else c.ended++;
    });
    // The "All" tab lists live rounds only.
    c.all = c.live;
    return c;
  }, [auctions, isMineAuction]);

  const filtered = useMemo(() => {
    let list = auctions;
    if (category) list = list.filter((a) => a.category_id === category);
    // A category tile shows everything in that category (live and upcoming).
    if (category && tab === "all") list = list.filter((a) => effectiveStatus(a) !== "ended");
    else if (tab === "all" || tab === "live") list = list.filter((a) => effectiveStatus(a) === "live");
    else if (tab === "open") list = list.filter((a) => effectiveStatus(a) === "open");
    else if (tab === "ended") list = list.filter((a) => effectiveStatus(a) === "ended");
    else if (tab === "mine") list = list.filter(isMineAuction);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((a) => (a.title || "").toLowerCase().includes(s));
    }

    const sorted = [...list];
    const statusRank = (a) => {
      const st = effectiveStatus(a);
      return st === "live" ? 0 : st === "open" ? 1 : 2;
    };
    sorted.sort((a, b) => {
      if (sort === "ending") {
        const ra = statusRank(a);
        const rb = statusRank(b);
        if (ra !== rb) return ra - rb;
        return new Date(a.end_time || 0) - new Date(b.end_time || 0);
      }
      if (sort === "priceLow") return (a.current_price || 0) - (b.current_price || 0);
      if (sort === "priceHigh") return (b.current_price || 0) - (a.current_price || 0);
      if (sort === "bids") return (bidsByAuction.total[b.id] || 0) - (bidsByAuction.total[a.id] || 0);
      return new Date(b.created_date) - new Date(a.created_date);
    });
    return sorted;
  }, [auctions, tab, sort, q, category, bidsByAuction]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const tabs = [
    { id: "all", label: h.filters.all, count: counts.all },
    { id: "live", label: h.filters.live, count: counts.live },
    { id: "open", label: h.filters.open, count: counts.open },
    { id: "ended", label: h.filters.ended, count: counts.ended },
    { id: "mine", label: h.filters.mine, count: counts.mine },
  ];
  const sorts = [
    { id: "newest", label: h.filters.newest },
    { id: "ending", label: h.filters.ending },
    { id: "priceLow", label: h.filters.priceLow },
    { id: "priceHigh", label: h.filters.priceHigh },
    { id: "bids", label: h.filters.bids },
  ];

  if (isMobileView) {
    return (
      <MobileAuctionsHub
        user={user}
        balance={walletBalance}
        featured={featured}
        tabs={tabs}
        activeTab={tab}
        onTab={(id) => setParam("tab", id === "all" ? "" : id)}
        sorts={sorts}
        activeSort={sort}
        onSort={(v) => setParam("sort", v === "newest" ? "" : v)}
        filtered={filtered}
        loading={loading}
        yourBids={bidsByAuction.mine}
        counts={counts}
        search={q}
        onSearch={(v) => setParam("q", v)}
        onRefresh={async () => {
          await base44.functions.invoke("syncAuctions").catch(() => {});
          await Promise.all([
            reload(),
            base44.entities.Bid.listFields("auction_id,user_id,amount,archived", "-created_date", 1000)
              .then((b) => setBids(b || []))
              .catch(() => {}),
          ]);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{h.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{h.subtitle}</p>
      </div>

      <DashboardStrip user={user} balance={walletBalance} stats={stats} />

      <div className="sticky top-16 z-30 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-xl rounded-xl border border-border/60">
        <AuctionFilters
          tabs={tabs}
          activeTab={tab}
          onTab={(id) => setParam("tab", id === "all" ? "" : id)}
          sorts={sorts}
          activeSort={sort}
          onSort={(v) => setParam("sort", v === "newest" ? "" : v)}
          search={q}
          onSearch={(v) => setParam("q", v)}
        />
      </div>

      {!loading && featured && (tab === "all" || tab === "live" || tab === "open") && (
        <FeaturedAuctionHero auction={featured} />
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Gavel className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{tab === "mine" ? h.emptyMine : h.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AuctionCard
              key={a.id}
              auction={a}
              yourBid={tab === "mine" ? bidsByAuction.mine[a.id] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

