import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Flame, Gavel, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Image } from "@/components/ui/image";
import { effectiveStatus, timeRemaining, formatCountdownRing } from "@/lib/auction";

/** Horizontal snap carousel of live/open auctions — app-store style shelf. */
export default function LiveCarousel({ title, auctions = [], loading, to = "/auctions", emptyLabel }) {
  const { t, dir } = useI18n();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" /></span>
          <h2 className="font-display text-[15px] font-extrabold text-foreground">{title}</h2>
        </div>
        <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-bold text-accent active:opacity-70">
          {t.dash.seeAll}
          <ChevronRight className={dir === "rtl" ? "w-4 h-4 rotate-180" : "w-4 h-4"} />
        </Link>
      </div>

      {loading ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 min-[520px]:grid-cols-2 min-[520px]:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          {emptyLabel || t.home.empty}
        </div>
      ) : (
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3 min-[520px]:grid-cols-2 min-[520px]:gap-4">
          {auctions.map((a, index) => {
            const st = effectiveStatus(a);
            const seats = a.subscriber_ids?.length || 0;
            const pct = Math.min(100, (seats / Math.max(1, a.max_subscribers)) * 100);
            return (
              <Link
                key={a.id}
                to={`/auction/${a.id}`}
                 className="group block w-full min-w-0 overflow-hidden rounded-2xl border border-border/90 bg-card shadow-[0_22px_50px_-34px_hsl(var(--accent)/0.75)] transition-transform active:scale-[0.98] lg:hover:-translate-y-1 lg:hover:border-accent/45"
              >
                <div className={index === 0 ? "relative h-52 bg-muted sm:h-56" : "relative h-40 bg-muted sm:h-44"}>
                  <Image src={a.image_url} alt={a.title} className="w-full h-full" fittingType="fill" />
                  <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/55 to-transparent" />
                  <span className="absolute top-3 ltr:left-3 rtl:right-3 inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/90 px-2.5 py-1 text-[10px] font-extrabold text-destructive-foreground shadow-[0_0_18px_hsl(var(--destructive)/0.35)] backdrop-blur">
                    {st === "live" ? <Flame className="w-3 h-3 text-destructive-foreground" /> : null}
                    {st === "live" ? t.auction.statusLive : t.auction.statusOpen}
                  </span>
                  <span className="timer-glow absolute top-3 ltr:right-3 rtl:left-3 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-primary tabular-nums backdrop-blur">{st === "live" ? formatCountdownRing(timeRemaining(a)) : t.auction.statusOpen}</span>
                </div>
                 <div className="relative -mt-5 p-4 pt-0">
                  <p className="line-clamp-1 text-[15px] font-extrabold text-foreground">{a.title}</p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="mb-1 text-[9px] font-bold text-muted-foreground">{t.auction.currentPrice}</p>
                      <p className="font-display text-[1.65rem] font-extrabold leading-none text-primary tabular-nums drop-shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
                      {t.common.currency}{Number(a.current_price || 0).toFixed(2)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1.5 text-[10px] font-bold text-accent"><Users className="h-3 w-3" />{seats}/{a.max_subscribers}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                     <div className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  {index === 0 ? <span className="gold-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold"><Gavel className="h-4 w-4" />{t.home.browse}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>

      )}
    </section>
  );
}
