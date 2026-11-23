import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import HomeAuctionCard from "@/components/home/HomeAuctionCard";
import { selectHomeAuctions } from "@/lib/homeShowcase";

export default function AuctionsGrid({ auctions, loading }) {
  const { t } = useI18n();
  const arrowCls = "";
  const shown = selectHomeAuctions(auctions);
  return (
    <section id="auctions" className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12 scroll-mt-20">
      <div className="mb-3 sm:mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">{t.home.sectionTitle}</h2>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{t.site.auctions.subtitle}</p>
        </div>
        <Link to="/auctions" className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
          {t.nav.auctions} <ArrowRight className={cn("w-4 h-4", arrowCls)} />
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <div className="p-4 space-y-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">{t.home.empty}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {shown.map((a) => <HomeAuctionCard key={a.id} auction={a} />)}
        </div>
      )}
    </section>
  );
}
