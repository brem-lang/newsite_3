import React, { memo, useEffect, useMemo, useState } from "react";
import { Flame, ArrowRight, Clock, Users } from "lucide-react";
import { themeVars, ensureThemeFonts } from "@/lib/themeDefaults";
import { useI18n } from "@/lib/i18n";

// A small copy of the customer homepage (header, hero, a featured card, an
// auction card and a stats tile) on the themed page background. It uses the
// same .site-themed rules as the live site (src/styles.css), so it shows
// exactly what the theme changes.
function ThemePreview({ theme }) {
  const { t, dir } = useI18n();
  // Which status the preview cards show.
  const [live, setLive] = useState(true);
  // Two elements: the outer one carries the --theme-* values, the inner
  // .site-themed maps them onto the tokens (one element doing both would be
  // a var() cycle when a value falls back to the site default).
  const style = useMemo(() => themeVars(theme, { withDefaults: true }), [theme]);

  useEffect(() => {
    ensureThemeFonts(theme);
  }, [theme.fontHeading, theme.fontBody, theme.fontDisplay]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = live ? t.auction?.statusLive : t.site?.hero?.notLive;

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-[10px] font-semibold" role="group">
        {[
          [true, t.auction?.statusLive],
          [false, t.site?.hero?.notLive],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={live === value}
            onClick={() => setLive(value)}
            className="px-2 py-1 rounded-md border border-border text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>

      <div dir={dir} style={style} className="rounded-2xl border border-border overflow-hidden">
        <div className="site-themed text-foreground" data-theme-heading={theme.heroHeading || theme.bodyText ? "" : undefined}>
          {/* Header strip */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
            <span className="theme-brand font-display text-sm font-extrabold">{t.brand}</span>
            <nav className="flex items-center gap-0.5 text-[10px] font-medium">
              <span className="theme-tab-hover theme-tab-active bg-secondary ring-1 rounded-lg px-2 py-1">{t.nav?.auctions}</span>
              <span className="theme-tab-hover cursor-default text-muted-foreground hover:bg-secondary/60 rounded-lg px-2 py-1">
                {t.nav?.wallet}
              </span>
              <span className="theme-tab-hover cursor-default text-muted-foreground hover:bg-secondary/60 rounded-lg px-2 py-1">
                {t.nav?.account}
              </span>
            </nav>
            <span className="gold-button rounded-lg px-2.5 py-1 text-[10px] font-bold">{t.auth?.register}</span>
          </div>

          <div className="p-4 space-y-3">
            {/* Hero */}
            <h3 className="font-display text-xl font-extrabold leading-tight text-foreground">{t.home?.heroTitle}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.home?.heroSubtitle}</p>
            <span className="gold-button inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold">
              <Flame className="w-3.5 h-3.5" /> {t.site?.hero?.browse} <ArrowRight className="w-3.5 h-3.5" />
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Featured card (solid badge, as in the hero) */}
              <div className="native-panel relative overflow-hidden rounded-xl">
                <div className="h-14 bg-muted relative">
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-lg border ${
                      live ? "theme-badge-live" : "theme-badge-open"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="photo-fade relative -mt-6 p-2 pt-6 space-y-1">
                  <h4 className="font-display font-extrabold text-xs text-foreground">iPhone 16 Pro Max</h4>
                  <p className="text-[9px] text-muted-foreground">{t.auction?.currentPrice}</p>
                  <p className="font-display text-sm font-extrabold text-primary">{t.common?.currency}142.00</p>
                  <span className="gold-button block text-center rounded-xl py-1 text-[9px] font-bold">
                    {t.site?.hero?.bidNow}
                  </span>
                </div>
              </div>

              {/* Auction card (soft badge, as in the grid) */}
              <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                <div className="h-14 bg-muted relative">
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                      live ? "theme-badge-live-soft" : "theme-badge-open-soft"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="photo-fade relative -mt-6 p-2 pt-6 space-y-1">
                  <h4 className="font-display font-extrabold text-xs text-foreground">PlayStation 5</h4>
                  <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Users className="w-3 h-3" /> 12/20
                  </p>
                  <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="w-3 h-3" /> 02:14:09
                  </p>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-3/5 rounded-full bg-accent" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main text, buttons and an input */}
            <p className="text-xs text-foreground">{t.home?.heroSubtitle}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="native-control rounded-xl px-2.5 py-1 text-[10px] font-bold">{t.auth?.login}</span>
              <span className="cyan-button rounded-xl px-2.5 py-1 text-[10px] font-bold">{t.site?.hero?.bidNow}</span>
              <span className="rounded-lg bg-secondary text-secondary-foreground px-2 py-1 text-[10px] font-semibold">+5</span>
              <span className="text-accent text-[10px] font-bold">{t.auction?.seats}</span>
            </div>
            <div className="h-7 rounded-lg border border-input bg-transparent px-2 text-[10px] text-muted-foreground flex items-center">
              {t.common?.search || "Search"}
            </div>

            {/* Auction chat */}
            <div className="native-panel rounded-xl p-2.5 space-y-1.5">
              <div className="flex justify-start">
                <div className="theme-chat-other max-w-[80%] rounded-2xl rounded-es-md px-2.5 py-1.5">
                  <p className="text-[9px] font-bold opacity-75">Sara</p>
                  <p className="text-[10px]">Good luck everyone!</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="theme-chat-mine max-w-[80%] rounded-2xl rounded-ee-md px-2.5 py-1.5">
                  <p className="text-[10px]">Thanks, you too</p>
                </div>
              </div>
            </div>

            {/* Stats tile */}
            <div className="native-panel rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{t.auction?.currentPrice}</span>
              <span className="font-display text-sm font-extrabold text-primary">{t.common?.currency}1,240</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-render only when the theme object changes, not on every editor render.
export default memo(ThemePreview);
