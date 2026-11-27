import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Users, Clock, ShieldCheck, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { heroCopy } from "@/lib/useContent";
import { effectiveStatus } from "@/lib/auction";
import { isRunningAuction } from "@/lib/homeShowcase";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SiteHero({ auctions, loading, authed, content, contentLoading = false }) {
  const { t } = useI18n();
  const { title: heroTitle, subtitle: heroSubtitle } = heroCopy(content, t);
  const arrowCls = "";
  const featured = pickHeroFeatured(auctions);

  return (
    <section className="relative overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-16 pb-5 sm:pb-8">
        <div className="grid lg:grid-cols-12 gap-5 sm:gap-8 items-center">
          <div className="lg:col-span-6 space-y-3.5 sm:space-y-5">
            {/* The headline is admin-edited site content. Until that request
                returns, show placeholder bars, not the built-in default, which
                would flash before being replaced. The default is used only
                when the loaded content has no hero_title / hero_subtitle. */}
            {contentLoading ? (
              <div
                className="space-y-3 sm:space-y-4"
                role="status"
                aria-busy="true"
                aria-label="Loading"
              >
                <div className="h-8 sm:h-12 w-4/5 rounded-lg bg-muted animate-pulse" />
                <div className="h-8 sm:h-12 w-3/5 rounded-lg bg-muted animate-pulse" />
                <div className="h-4 w-full max-w-lg rounded bg-muted animate-pulse" />
                <div className="h-4 w-2/3 max-w-md rounded bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                <h1 className="font-display text-[1.7rem] sm:text-5xl font-extrabold leading-[1.1] tracking-tight text-foreground">
                  {heroTitle}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg line-clamp-2 sm:line-clamp-none">
                  {heroSubtitle}
                </p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {authed ? (
                <a href="#auctions" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto gap-2 h-12 px-5 sm:px-7 font-bold shadow-lg shadow-primary/25"
                  >
                    <Flame className="w-4 h-4" /> {t.site.hero.browse}{" "}
                    <ArrowRight className={cn("w-4 h-4", arrowCls)} />
                  </Button>
                </a>
              ) : (
                <>
                  <Link to="/register" className="flex-1 min-w-[9rem] sm:flex-none">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto gap-2 h-12 px-5 sm:px-7 font-bold shadow-lg shadow-primary/25"
                    >
                      {t.auth.register} <ArrowRight className={cn("w-4 h-4", arrowCls)} />
                    </Button>
                  </Link>
                  <Link to="/login" className="flex-1 min-w-[7rem] sm:flex-none">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto h-12 px-5 sm:px-7"
                    >
                      {t.auth.login}
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
              {t.site.hero.trust.map((chip, i) => {
                const Icon = [Users, Clock, ShieldCheck][i] || Zap;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
                  >
                    <Icon className="w-4 h-4 text-accent" />
                    {chip}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-6">
            {loading ? (
              <div className="rounded-xl border border-border bg-card p-6 animate-pulse h-72" />
            ) : !featured ? (
              <EmptyHeroCard authed={authed} />
            ) : (
              <FeaturedHeroCard auction={featured} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The auction the hero features, or null when nothing is running. Only
 *  running auctions qualify (never ended, archived or cancelled ones): the
 *  admin's featured picks in their order first, else the newest running
 *  auctions; a live one is preferred within that pool. */
export function pickHeroFeatured(auctions) {
  const running = (auctions || []).filter(isRunningAuction);
  const curated = running
    .filter((a) => a.featured)
    .sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
  const pool = curated.length > 0
    ? curated
    : [...running].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  return pool.find((a) => effectiveStatus(a) === "live") || pool[0] || null;
}

/** Hero card when no auction is running: no stale auction, no endless skeleton. */
export function EmptyHeroCard({ authed = false, preview = false }) {
  const { t } = useI18n();
  const h = t.site.hero;
  return (
    <div className="native-panel rounded-xl h-72 grid place-items-center p-6 text-center">
      <div className="max-w-xs space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Clock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="font-display font-extrabold text-base text-foreground">{h.emptyTitle}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{authed ? h.emptyBodyAuthed : h.emptyBody}</p>
        {!preview && !authed && (
          <Link to="/register" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
            {t.auth.register} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** The featured auction card beside the hero copy. `preview` (admin → Hero)
 *  renders it without the link, so clicking the preview stays in admin. */
export function FeaturedHeroCard({ auction, preview = false }) {
  const { t } = useI18n();
  const live = effectiveStatus(auction) === "live";
  return (
    <div className="native-panel relative overflow-hidden rounded-xl">
      {/* The photo fills the card; the details sit on a fade over it. */}
      <div className="absolute inset-0 bg-muted">
        <Image
          src={auction.image_url}
          alt={auction.title}
          className="w-full h-full"
          fittingType="fill"
        />
      </div>
      <div className="relative aspect-[16/8]">
        <span
          className={cn(
            "absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-lg border",
            live
              ? "theme-badge-live animate-pulse"
              : "theme-badge-open",
          )}
        >
          {live ? t.auction.statusLive : t.site.hero.notLive}
        </span>
        <span className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground border border-primary">
          {t.site.hero.featured}
        </span>
      </div>
      <div className="photo-fade relative -mt-12 p-5 pt-12 space-y-3">
        <h3 className="font-display font-extrabold text-base text-foreground line-clamp-1">
          {auction.title}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t.auction.currentPrice}</p>
            <p className="font-display text-2xl font-extrabold text-primary">
              {t.common.currency}
              {auction.current_price?.toFixed(2) || "0.00"}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-muted-foreground">{t.auction.seats}</p>
            <p className="font-bold text-foreground">
              {auction.subscriber_ids?.length || 0}/{auction.max_subscribers}
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-accent"
            style={{
              width: `${Math.min(100, ((auction.subscriber_ids?.length || 0) / Math.max(1, auction.max_subscribers)) * 100)}%`,
            }}
          />
        </div>
        {preview ? (
          <Button type="button" tabIndex={-1} className="w-full h-11 font-bold gap-2 pointer-events-none">
            <Flame className="w-4 h-4" /> {t.site.hero.bidNow}
          </Button>
        ) : (
          <Link to="/auction/$id" params={{ id: auction.id }}>
            <Button className="w-full h-11 font-bold gap-2">
              <Flame className="w-4 h-4" /> {t.site.hero.bidNow}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
