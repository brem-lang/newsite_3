import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Users, Clock, ShieldCheck, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { contentValue } from "@/lib/useContent";
import { effectiveStatus } from "@/lib/auction";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SiteHero({ auctions, loading, authed, content }) {
  const { t, lang } = useI18n();
  const heroTitle = contentValue(content, "hero_title", lang, t.home.heroTitle);
  const heroSubtitle = contentValue(content, "hero_subtitle", lang, t.home.heroSubtitle);
  const arrowCls = "";
  const curated = auctions
    .filter((a) => a.featured && effectiveStatus(a) !== "ended")
    .sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
  const pool = curated.length > 0 ? curated : auctions;
  const featured = pool.find((a) => effectiveStatus(a) === "live") || pool[0];
  const live = featured && effectiveStatus(featured) === "live";

  return (
    <section className="relative overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-16 pb-5 sm:pb-8">
        <div className="grid lg:grid-cols-12 gap-5 sm:gap-8 items-center">
          <div className="lg:col-span-6 space-y-3.5 sm:space-y-5">
            <h1 className="font-display text-[1.7rem] sm:text-5xl font-extrabold leading-[1.1] tracking-tight text-foreground">{heroTitle}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg line-clamp-2 sm:line-clamp-none">{heroSubtitle}</p>
            <div className="flex flex-wrap items-center gap-3">
              {authed ? (
                <a href="#auctions" className="w-full sm:w-auto"><Button size="lg" className="w-full sm:w-auto gap-2 h-12 px-5 sm:px-7 font-bold shadow-lg shadow-primary/25"><Flame className="w-4 h-4" /> {t.site.hero.browse} <ArrowRight className={cn("w-4 h-4", arrowCls)} /></Button></a>
              ) : (
                <>
                  <Link to="/register" className="flex-1 min-w-[9rem] sm:flex-none"><Button size="lg" className="w-full sm:w-auto gap-2 h-12 px-5 sm:px-7 font-bold shadow-lg shadow-primary/25">{t.auth.register} <ArrowRight className={cn("w-4 h-4", arrowCls)} /></Button></Link>
                  <Link to="/login" className="flex-1 min-w-[7rem] sm:flex-none"><Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-5 sm:px-7">{t.auth.login}</Button></Link>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
              {t.site.hero.trust.map((chip, i) => {
                const Icon = [Users, Clock, ShieldCheck][i] || Zap;
                return (<span key={i} className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"><Icon className="w-4 h-4 text-accent" />{chip}</span>);
              })}
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-6">
            {loading || !featured ? (
              <div className="rounded-xl border border-border bg-card p-6 animate-pulse h-72" />
            ) : (
              <div className="native-panel rounded-xl p-3">
                <div className="relative rounded-lg overflow-hidden aspect-[16/10] bg-muted">
                  <Image src={featured.image_url} alt={featured.title} className="w-full h-full" fittingType="fill" />
                  <span className={cn("absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-lg border", live ? "bg-destructive text-destructive-foreground border-destructive animate-pulse" : "bg-card/90 text-foreground border-border")}>{live ? t.auction.statusLive : t.site.hero.notLive}</span>
                  <span className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground border border-primary">{t.site.hero.featured}</span>
                </div>
                <div className="p-4 space-y-3">
                  <h3 className="font-display font-extrabold text-base text-foreground line-clamp-1">{featured.title}</h3>
                  <div className="flex items-end justify-between">
                    <div><p className="text-[11px] text-muted-foreground">{t.auction.currentPrice}</p><p className="font-display text-2xl font-extrabold text-primary">{t.common.currency}{featured.current_price?.toFixed(2) || "0.00"}</p></div>
                    <div className="text-end"><p className="text-[11px] text-muted-foreground">{t.auction.seats}</p><p className="font-bold text-foreground">{featured.subscriber_ids?.length || 0}/{featured.max_subscribers}</p></div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ((featured.subscriber_ids?.length || 0) / Math.max(1, featured.max_subscribers)) * 100)}%` }} /></div>
                  <Link to={`/auction/${featured.id}`}><Button className="w-full h-11 font-bold gap-2"><Flame className="w-4 h-4" /> {t.site.hero.bidNow}</Button></Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
