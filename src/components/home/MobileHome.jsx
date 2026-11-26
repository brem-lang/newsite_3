import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { useCategories } from "@/lib/queries/config";
import { CategoryIcon } from "@/lib/categoryIcons";

const NO_CATEGORIES = [];
import { useI18n } from "@/lib/i18n";
import { useHeroContent } from "@/lib/useContent";
import { effectiveStatus } from "@/lib/auction";
import LiveCountdown from "@/components/auction/LiveCountdown";
import { selectHomeAuctions } from "@/lib/homeShowcase";
import { Image } from "@/components/ui/image";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { homeHighlights, feedAuctionIds } from "@/lib/homeHighlights";
import { useRecentBids } from "@/lib/queries/auctions";
import RecentActivity from "@/components/home/dashboard/RecentActivity";
import MyAuctionsStrip from "@/components/home/dashboard/MyAuctionsStrip";
import WalletCard from "@/components/home/dashboard/WalletCard";
import MyBidsList from "@/components/home/dashboard/MyBidsList";
import SpotlightHero from "@/components/home/dashboard/SpotlightHero";
import PulseStrip from "@/components/home/dashboard/PulseStrip";
import NextStepCard from "@/components/home/dashboard/NextStepCard";
import FillingFast from "@/components/home/dashboard/FillingFast";

export default function MobileHome({ auctions, loading, authed, userName, userId = null, balance = 0, transactions = null, walletLoading = false, mine = null, wallet = null, endingSoon = null, withNav = true }) {
  const { t, dir } = useI18n();
  const { data: dbCategories = NO_CATEGORIES } = useCategories();
  const list = selectHomeAuctions(auctions);
  // Spotlight, live pulse, "filling fast" and (signed in) the next step.
  const highlights = React.useMemo(
    () => homeHighlights(auctions || [], { userId: authed ? userId : null, balance }),
    [auctions, authed, userId, balance]
  );
  const { spotlight } = highlights;
  // Live bid feed (public-bid live auctions only; signed out it reads nothing).
  const feedIds = React.useMemo(() => feedAuctionIds(auctions || []), [auctions]);
  const { data: recentBids = NO_CATEGORIES } = useRecentBids(authed ? userId : null, feedIds);
  const auctionsById = React.useMemo(() => Object.fromEntries((auctions || []).map((a) => [a.id, a])), [auctions]);
  // Trending leaves out the auction already in the spotlight.
  const rest = list.filter((a) => a.id !== spotlight?.id);
  const featured = rest[0] || (spotlight ? null : list[0]);
  const trending = rest.slice(1, 3);
  const ArrowIcon = ChevronRight;
  // Same admin-edited hero copy as the desktop SiteHero (admin → Hero).
  const hero = useHeroContent(t);

  const copy = {
        // Signed in, the greeting is personal; signed out it is the hero headline.
        greeting: userName ? `Welcome ${userName}` : hero.title,
        subtitle: hero.subtitle,
        search: "Search for anything in MIZAD...",
        categories: ["Cars", "Watches", "Property", "Electronics"],
        live: "Live auctions",
        liveSub: "Live offers · bid your best price",
        cta: "Browse now",
        viewAll: "View all",
        subscribe: "Join now",
        trending: "Trending auctions",
        current: "Current price",
      };

  // Reference screen 04: identical navy tiles, only the icon carries colour.
  const tones = ["text-accent", "text-primary", "text-accent", "text-accent"];
  // Icon keys for the placeholder tiles shown before any category has auctions.
  const icons = ["Car", "Watch", "Building2", "Smartphone"];

  // Real categories that actually have auctions, so a tile always opens results.
  const liveCategories = React.useMemo(() => {
    const counts = new Map();
    (auctions || []).forEach((a) => {
      if (!a?.category_id) return;
      counts.set(a.category_id, (counts.get(a.category_id) || 0) + 1);
    });
    return (dbCategories || [])
      .filter((c) => counts.has(c.id))
      .slice(0, 4)
      .map((c, i) => ({
        key: c.id,
        label: c.name,
        to: `/auctions?category=${c.id}`,
        icon: c.icon,
        tone: tones[i % tones.length],
      }));
  }, [auctions, dbCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = liveCategories.length
    ? liveCategories
    : copy.categories.map((label, i) => ({
        key: label,
        label,
        to: "/auctions",
        icon: icons[i],
        tone: tones[i],
      }));

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-background pb-[calc(var(--app-tabbar-h)+1rem)] text-foreground"
      dir={dir}
    >
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/94 px-4 pb-3 pt-[calc(var(--safe-top)+0.75rem)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={authed ? "/account" : "/login"}
              className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary/70 bg-primary/10 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.2)]"
              aria-label={authed ? t.nav.profile : t.auth.login}
            >
              <UserRound className="h-5 w-5" />
            </Link>
            {/* Placeholder bars until the content loads, so the built-in
                default never flashes before the admin copy (as in SiteHero). */}
            {hero.loading ? (
              <div className="min-w-0 flex-1 space-y-1.5" role="status" aria-busy="true" aria-label="Loading">
                <div className="h-4 w-40 max-w-full rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-52 max-w-full rounded bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold text-foreground">{copy.greeting}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-muted-foreground">{copy.subtitle}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to={authed ? "/account" : "/login"}
              aria-label={t.notifications.title}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-card" />
            </Link>
          </div>
        </div>

        <Link to="/auctions" className="mt-3 flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-muted-foreground shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-[11px] font-semibold">{copy.search}</span>
        </Link>
      </header>

      <main className="space-y-5 px-4 pt-4">
        <section className="grid grid-cols-4 gap-2" aria-label="Categories">
          {categories.map(({ icon, label, tone, to, key }) => (
            <Link key={key} to={to} className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-1 py-3">
              <CategoryIcon icon={icon} className={cn("h-5 w-5 text-lg", tone)} />
              <span className="max-w-full truncate text-[9px] font-extrabold text-foreground">{label}</span>
            </Link>
          ))}
        </section>

        {authed ? <NextStepCard step={highlights.nextStep} /> : null}

        {authed && mine ? <MyAuctionsStrip items={mine} /> : null}

        {spotlight ? <SpotlightHero auction={spotlight} userId={authed ? userId : null} compact /> : null}

        <PulseStrip pulse={highlights.pulse} compact />

        {/* Signed in: balance and the live auctions ending first, above the activity. */}
        {authed && wallet ? <WalletCard balance={wallet.balance} joined={wallet.joined} activeBids={wallet.activeBids} /> : null}

        {authed && endingSoon?.length ? (
          <section className="min-w-0">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive"><Clock className="h-3.5 w-3.5" /></span>
              <h2 className="text-[15px] font-extrabold text-foreground">{t.dash.endingSoon}</h2>
            </div>
            <MyBidsList items={endingSoon} loading={false} row moving />
          </section>
        ) : null}

        {authed || recentBids.length > 0 ? (
          <RecentActivity
            bids={recentBids}
            auctionsById={auctionsById}
            userId={authed ? userId : null}
            transactions={transactions || []}
            walletLoading={walletLoading}
            showWallet={authed && Array.isArray(transactions)}
            limit={5}
          />
        ) : null}

        {/* No auction to put in the spotlight: the generic banner instead. */}
        {!spotlight ? (
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-[170px] bg-muted">
            {featured ? (
              <Image src={featured.image_url} alt={featured.title} className="h-full w-full" fittingType="fill" />
            ) : null}
            <span className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          </div>
          <div className="relative -mt-16 px-4 pb-4 text-center">
            <h2 className="font-display text-[1.6rem] font-extrabold leading-tight text-foreground">{copy.live}</h2>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{copy.liveSub}</p>
            <Link to="/auctions" className="gold-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold">
              <Gavel className="h-4 w-4" /> {copy.cta}
            </Link>
          </div>
        </section>
        ) : null}

        <FillingFast auctions={highlights.fillingFast.slice(0, 2)} compact />

        {/* Hidden when the spotlight is the only running auction. */}
        {featured || loading || !spotlight ? (
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <h1 className="text-[17px] font-extrabold">{copy.trending}</h1>
            </div>
            <Link to="/auctions" className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
              {copy.viewAll} <ArrowIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />)}
            </div>
          ) : featured ? (
            <div className="grid grid-cols-2 gap-3">
              {[featured, ...trending].slice(0, 2).map((auction) => (
                <Link
                  key={auction.id}
                  to="/auction/$id" params={{ id: auction.id }}
                  className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-muted">
                    <Image src={auction.image_url} alt={auction.title} className="h-full w-full" fittingType="fill" />
                  </div>
                  <div className="relative h-20">
                    <span
                      className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-extrabold ${
                        effectiveStatus(auction) === "live" ? "theme-badge-live" : "theme-badge-open"
                      }`}
                    >
                      <Flame className="h-2.5 w-2.5" />
                      {effectiveStatus(auction) === "live" ? t.auction.statusLive : t.auction.statusOpen}
                    </span>
                  </div>
                  <div className="photo-fade relative -mt-8 p-2.5 pt-8">
                    <span className="timer-glow inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-extrabold text-primary tabular-nums">
                      <Clock className="h-3 w-3" />
                      <LiveCountdown auction={auction} fallback={t.auction.statusOpen} />
                    </span>
                    <p className="mt-1.5 truncate text-[11px] font-extrabold">{auction.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <p className="truncate text-[13px] font-extrabold text-primary tabular-nums">
                        {t.common.currency}{Number(auction.current_price || 0).toFixed(0)}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-accent">
                        <Users className="h-3 w-3" />{auction.subscriber_ids?.length || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">{t.home.empty}</div>
          )}
        </section>
        ) : null}

      </main>

      {withNav ? <BottomNav /> : null}
    </div>
  );
}
