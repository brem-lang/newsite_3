import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Clock, ArrowRight, Wallet as WalletIcon, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency, Money } from "@/lib/currency";
import { effectiveStatus, timeRemaining, formatCountdown, formatCountdownCompact, formatDuration, displayPrice, displayPriceKey } from "@/lib/auction";
import { useAuctionCountdown } from "@/lib/useAuctionCountdown";
import { Image } from "@/components/ui/image";
import { SlidersHorizontal, Check, Search } from "lucide-react";
import BottomSheet from "@/components/ui/bottom-sheet";
import useSwipe from "@/lib/useSwipe";
import { cn } from "@/lib/utils";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";

const noScroll = "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]";

function FeaturedLiveStrip({ auction, symbol, t, arrowCls }) {
  const [remaining, setRemaining] = useState(() => timeRemaining(auction));
  useEffect(() => {
    setRemaining(timeRemaining(auction));
    const id = setInterval(() => setRemaining(timeRemaining(auction)), 1000);
    return () => clearInterval(id);
  }, [auction?.id, auction?.end_time, auction?.status]);

  const seats = auction.subscriber_ids?.length || 0;
  const max = auction.max_subscribers || 0;
  const pct = max ? Math.min(100, Math.round((seats / max) * 100)) : 0;
  const live = effectiveStatus(auction) === "live";
  const urgent = live && remaining > 0 && remaining < 60000;

  return (
    <Link
      to={`/auction/${auction.id}`}
      aria-label={`${auction.title} — ${t.auction.statusLive}`}
      className="mx-4 mb-2.5 rounded-xl bg-card border border-border p-3 flex items-center gap-3 shadow-[0_12px_30px_-24px_hsl(var(--accent)/0.5)] active:scale-[0.99] transition"
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full" fittingType="fill" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              {t.auction.statusLive}
            </span>
          )}
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full border shrink-0",
               urgent ? "bg-destructive text-destructive-foreground border-destructive animate-pulse" : "bg-primary text-primary-foreground border-primary"
            )}
          >
            <Clock className="w-3 h-3" />
            {remaining > 0 ? formatCountdownCompact(remaining, t) : "00:00"}
          </span>
          <span className="text-[11px] font-bold text-primary truncate ms-auto">
            {symbol}{displayPrice(auction, "live").toFixed(2)}
          </span>
        </div>

        <h3 className="font-bold text-sm line-clamp-1 text-foreground">{auction.title}</h3>

        <div className="mt-1.5 flex items-center gap-2">
           <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
            <Users className="w-3 h-3" />
            {seats}/{max}
          </span>
        </div>
      </div>

      <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold px-3 py-2 shadow-sm">
        <Gavel className="w-3.5 h-3.5" />
        <ArrowRight className={cn("w-3.5 h-3.5", arrowCls)} />
      </span>
    </Link>
  );
}


export default function MobileAuctionsHub({
  user,
  balance,
  featured,
  tabs,
  activeTab,
  onTab,
  sorts,
  activeSort,
  onSort,
  filtered,
  loading,
  yourBids,
  counts,
  onRefresh,
  search,
  onSearch,
}) {
  const { t, dir } = useI18n();
  const { symbol } = useCurrency();
  const h = t.hub;
  const arrowCls = "";
  const showFeatured = !!featured && (activeTab === "all" || activeTab === "live" || activeTab === "open");
  // Hide the pinned featured strip when the same auction is already the
  // first card in the grid — it's redundant to show it twice back-to-back.
  const featuredIsFirst = !!featured && filtered.length > 0 && filtered[0].id === featured.id;

  const activeLabel = (tabs.find((x) => x.id === activeTab) || tabs[0]).label;
  const activeSortLabel = (sorts.find((x) => x.id === activeSort) || sorts[0]).label;
  const [sortOpen, setSortOpen] = useState(false);

  // Swiping left/right moves through the filter tabs, like a native pager.
  const tabIndex = Math.max(0, tabs.findIndex((x) => x.id === activeTab));
  const goTab = (delta) => {
    const next = tabs[tabIndex + delta];
    if (next) onTab(next.id);
  };
  const swipeRef = useSwipe({
    onSwipeLeft: () => goTab(1),
    onSwipeRight: () => goTab(-1)
  });

  return (
    <PullToRefresh
      onRefresh={onRefresh}
      scroll={false}
      dir={dir}
      className="app-shell fixed! z-10 flex flex-col bg-bidly text-foreground page-transition"
      
      innerClassName="flex flex-col flex-1 min-h-0"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded-full truncate max-w-full">
            {user?.full_name || h.subtitle}
          </span>
          <h1 className="font-display font-extrabold text-2xl leading-tight truncate text-foreground mt-1">{h.title}</h1>
        </div>
        <Link to="/wallet" className="shrink-0 flex items-center gap-2 rounded-xl bg-card border border-border shadow-sm px-3.5 py-2.5 active:scale-95 transition">
          <span className="bg-accent/10 p-1.5 rounded-lg">
            <WalletIcon className="w-4 h-4 text-accent" />
          </span>
          <span className="text-sm font-bold text-foreground">{symbol}{Number(balance || 0).toFixed(2)}</span>
        </Link>
      </div>

      {/* Featured live — hidden when the same auction is already the first list row */}
      {showFeatured && !featuredIsFirst && <FeaturedLiveStrip auction={featured} symbol={symbol} t={t} arrowCls={arrowCls} />}

      <div className="relative mx-5 mt-2">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t.hub.search || t.account.myBids}
          className="h-11 w-full rounded-lg border border-border bg-card/90 ps-10 pe-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Filter chips */}
      <div className={cn("flex items-center gap-2 overflow-x-auto px-5 py-3", noScroll)}>
        {tabs.map((tb) => {
          const active = tb.id === activeTab;
          return (
            <Button
              key={tb.id}
              type="button"
              variant={active ? "gold" : "outline"}
              onClick={() => onTab(tb.id)}
              aria-pressed={active}
              className={cn(
                "h-11 shrink-0 gap-2 px-4 text-sm",
                !active && "text-muted-foreground"
              )}
            >
              {tb.label}
              <span className={cn("text-[10px] leading-none px-1.5 py-0.5 rounded font-bold", active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {tb.count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Section title + sort */}
      <div className="flex items-center justify-between px-5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest truncate">
            {activeLabel}
          </h2>
          <span className="w-4 h-4 shrink-0 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            {loading ? "…" : filtered.length}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSortOpen(true)}
          className="tap-44 gap-2 px-3 text-xs"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          {activeSortLabel}
        </Button>
      </div>

       {/* Compact native list */}
       <div ref={swipeRef} className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4", noScroll)}>
        {loading ? (
           <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
               <div key={i} className="h-28 rounded-xl bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
            <div className="relative mb-6">
              <div className="absolute -inset-4 bg-accent/10 rounded-full blur-2xl" aria-hidden="true" />
              <div className="w-28 h-28 bg-card rounded-xl flex items-center justify-center shadow-xl relative border border-border">
                <Gavel className="w-14 h-14 text-accent/40" strokeWidth={1} />
                <div className="absolute w-11 h-11 bg-accent rounded-lg flex items-center justify-center shadow-lg -bottom-2 -right-2 rotate-12">
                  <ArrowRight className={cn("w-5 h-5 text-accent-foreground -rotate-45", arrowCls)} strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{h.noBidsYet}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px]">
              {activeTab === "mine" ? h.emptyMine : h.empty}
            </p>
            <Link
              to="/auctions"
              onClick={() => activeTab === "mine" && onTab("all")}
              className="mt-8 px-8 py-3.5 bg-primary text-primary-foreground rounded-lg font-bold text-sm shadow-xl active:scale-95 transition-transform"
            >
              {h.exploreAuctions}
            </Link>
          </div>
        ) : (
           <div className="space-y-2.5">
            {filtered.map((a) => (
              <MobileTile
                key={a.id}
                auction={a}
                yourBid={yourBids?.[a.id]}
                symbol={symbol}
                t={t}
                arrowCls={arrowCls}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sort picker as a native bottom sheet */}
      <BottomSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title={h.filters.newest ? activeLabel : ""}
        icon={SlidersHorizontal}
      >
        <div className="space-y-1.5 pb-1">
          {sorts.map((s) => {
            const active = s.id === activeSort;
            return (
              <Button
                key={s.id}
                type="button"
                variant={active ? "gold" : "outline"}
                onClick={() => { onSort(s.id); setSortOpen(false); }}
                className={cn(
                  "tap-44 w-full justify-between gap-3 px-4 text-sm",
                  !active && "text-foreground"
                )}
              >
                {s.label}
                {active && <Check className="w-4 h-4" />}
              </Button>
            );
          })}
        </div>
      </BottomSheet>
    </PullToRefresh>
  );
}

function MobileTile({ auction, yourBid, symbol, t, arrowCls }) {
  const { status, remaining, durationMinutes } = useAuctionCountdown(auction);
  const filled = auction.subscriber_ids?.length || 0;
  const pct = auction.max_subscribers ? Math.min(100, (filled / auction.max_subscribers) * 100) : 0;
  const statusLabel = { open: t.auction.statusOpen, live: t.auction.statusLive, ended: t.auction.statusEnded }[status];
  const badgeCls = status === "live"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : status === "open"
      ? "bg-success/15 text-success border-success/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Link
      to={`/auction/${auction.id}`}
       className="native-panel flex min-h-[112px] w-full overflow-hidden rounded-xl active:scale-[0.99] transition"
    >
       <div className="relative w-[112px] shrink-0 bg-muted">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full" fittingType="fill" />
        <span className={cn("absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur", badgeCls)}>
          {statusLabel}
        </span>
        <span className="absolute top-2.5 right-2.5 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-primary text-primary-foreground border border-primary">
          {symbol}{auction.entry_fee}
        </span>
      </div>
       <div className="min-w-0 flex-1 flex flex-col p-3 gap-2">
        <h3 className="font-display font-bold text-sm text-foreground leading-snug line-clamp-2">{auction.title}</h3>
         <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-accent" />{filled}/{auction.max_subscribers}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{status === "live" ? formatCountdownCompact(remaining, t) : status === "ended" ? t.auction.statusEnded : formatDuration(durationMinutes, t)}</span>
        </div>
        {/* seats progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
         <div className="mt-auto pt-2 border-t border-border/70 flex flex-col gap-1.5">
          {yourBid != null && (
            <p className="text-[10px] font-bold text-accent truncate">{t.auction.yourBid}: {symbol}{yourBid.toFixed(2)}</p>
          )}
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{t.auction[displayPriceKey(auction, status)]}</span>
            <span className="font-display text-lg font-extrabold text-primary leading-none truncate">
              <Money amount={displayPrice(auction, status)} codeClassName="opacity-50" />
            </span>
          </div>
           <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
             {t.auction.view} <ArrowRight className={cn("w-3 h-3", arrowCls)} />
           </span>
        </div>

      </div>
    </Link>
  );
}