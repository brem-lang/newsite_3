import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { effectiveStatus, displayPrice, displayPriceKey, formatCountdownCompact } from "@/lib/auction";
import { Image } from "@/components/ui/image";

export default function FeaturedAuctionHero({ auction }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const navigate = useNavigate();
  const status = effectiveStatus(auction);
  const filled = auction.subscriber_ids?.length || 0;
  const max = auction.max_subscribers || 1;
  const pct = Math.min(100, Math.round((filled / max) * 100));
  const isLive = status === "live";

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = isLive && auction.end_time
    ? Math.max(0, new Date(auction.end_time).getTime() - now)
    : 0;
  const timerText = isLive
    ? formatCountdownCompact(remaining, t)
    : t.auction.startsWhenFull;

  return (
    <button
      type="button"
      onClick={() => navigate(`/auction/${auction.id}`)}
      className="native-panel group grid w-full overflow-hidden rounded-xl text-start transition-all hover:-translate-y-0.5 hover:border-accent/45 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-stretch"
    >
      <div className="relative w-full aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[320px] lg:max-h-[380px] bg-muted overflow-hidden">
        <Image src={auction.image_url} alt={auction.title} fittingType="fill" className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute top-3 right-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground">
          {isLive ? t.street.live : t.auction.statusOpen}
        </span>
        <span className="absolute top-3 left-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
          {symbol}{auction.entry_fee}
        </span>
      </div>

      <div className="p-5 sm:p-6 space-y-4 lg:flex lg:flex-col lg:justify-center lg:space-y-5">
        <h3 className="font-display text-lg sm:text-xl lg:text-2xl font-extrabold text-foreground leading-snug">{auction.title}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 border border-border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">{t.auction[displayPriceKey(auction, status)]}</p>
            <p className="font-display text-2xl font-extrabold text-primary">{symbol}{displayPrice(auction, status).toFixed(2)}</p>
          </div>
          <div className="timer-glow rounded-xl p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">{t.auction.timeRemaining}</p>
            <p className="font-mono text-2xl font-extrabold text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.35)]">{timerText}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-muted-foreground">{t.auction.seats}</span>
            <span className="text-primary">{filled}/{max}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-dashed border-accent/50 bg-accent/10 px-4 py-3">
          <Bot className="w-5 h-5 text-accent shrink-0" />
          <div>
            <p className="text-sm font-bold text-accent">{t.auction.autoBidOn}</p>
            <p className="text-[11px] text-muted-foreground">{t.auction.maxBidHint}</p>
          </div>
        </div>
      </div>
    </button>
  );
}