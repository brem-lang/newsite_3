import React from "react";
import { themeToStyle } from "@/lib/themeDefaults";
import { useI18n } from "@/lib/i18n";

export default function ThemePreview({ theme }) {
  const { t, dir } = useI18n();
  const style = themeToStyle(theme);
  const cardRadius = theme?.sections?.card?.radius ?? 16;
  const heroAccent = theme?.sections?.hero?.accent ?? "lime";
  const accentClass =
    heroAccent === "pink" ? "bg-neon-pink text-white" : heroAccent === "violet" ? "bg-neon-violet text-white" : "bg-neon-lime text-ink-950";

  return (
    <div
      dir={dir}
      style={style}
      className="rounded-2xl overflow-hidden border border-border bg-ink-950 font-body"
    >
      {/* Hero */}
      <div className="px-5 pt-6 pb-5">
        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${accentClass}`}>
          {t.street?.live || "LIVE"}
        </span>
        <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight text-foreground">
          {t.home?.heroTitle || "Bid up, win smart."}
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground">{t.home?.heroSubtitle || "Flat entry · limited seats · highest bid wins"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground">
            {t.site?.hero?.browse || "Browse auctions"}
          </span>
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold border border-border text-foreground">
            {t.auction?.view || "View auction"}
          </span>
        </div>
      </div>

      {/* Auction card */}
      <div className="mx-4 mb-4 border border-border bg-card overflow-hidden" style={{ borderRadius: cardRadius }}>
        <div className="h-20 w-full bg-gradient-to-br from-neon-lime/40 to-neon-pink/30" />
        <div className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-pink/15 text-neon-pink font-bold">
              {t.auction?.statusLive || "Live now"}
            </span>
            <span className="text-[10px] text-muted-foreground">{t.auction?.entryFee} $10</span>
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">iPhone 16 Pro Max</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{t.auction?.currentPrice}</span>
            <span className="font-display font-extrabold text-neon-lime">$142</span>
          </div>
        </div>
      </div>

      {/* Chips / badges */}
      <div className="px-4 pb-5 flex flex-wrap gap-2">
        <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-neon-violet text-white">{t.auction?.chipMin || "+Min"}</span>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-neon-lime text-neon-lime">$100</span>
        <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-secondary text-secondary-foreground">+5</span>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neon-lime text-ink-950">{t.street?.newBid || "New bid"}</span>
      </div>
    </div>
  );
}