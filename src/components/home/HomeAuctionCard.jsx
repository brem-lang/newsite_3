import React from "react";
import { Link } from "@tanstack/react-router";
import { Users, Clock, ArrowRight, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency, Money } from "@/lib/currency";
import { formatCountdown, formatCountdownCompact, formatDuration, displayPrice, displayPriceKey } from "@/lib/auction";
import { useAuctionCountdown } from "@/lib/useAuctionCountdown";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

export default function HomeAuctionCard({ auction, yourBid }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const { status, remaining, durationMinutes } = useAuctionCountdown(auction);
  const filled = auction.subscriber_ids?.length || 0;
  const pct = auction.max_subscribers ? Math.min(100, (filled / auction.max_subscribers) * 100) : 0;
  const statusLabel = { open: t.auction.statusOpen, live: t.auction.statusLive, ended: t.auction.statusEnded }[status];
  const arrowCls = "";

  const badgeCls = status === "live"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : status === "open"
      ? "bg-success/15 text-success border-success/30"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Link
      to="/auction/$id" params={{ id: auction.id }}
      className="native-panel group relative block rounded-xl overflow-hidden hover:border-accent/45 hover:-translate-y-1 transition-all"
    >
      <div className="absolute inset-0 overflow-hidden bg-muted">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full transition-transform duration-500 group-hover:scale-105" fittingType="fill" />
      </div>
      <div className="relative aspect-[16/9]">
        <span className={cn("absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-md border", badgeCls)}>
          {statusLabel}
        </span>
        <span className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-md bg-card/90 text-foreground border border-border backdrop-blur">
          {symbol}{auction.entry_fee}
        </span>
      </div>
      <div className="photo-fade relative -mt-10 p-3 pt-10 sm:p-4 sm:pt-10 space-y-2 sm:space-y-3">
        <h3 className="font-display font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-1">{auction.title}</h3>
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-accent" />{filled}/{auction.max_subscribers}</span>
          <span className="hidden sm:flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />{status === "live" ? formatCountdownCompact(remaining, t) : status === "ended" ? t.auction.statusEnded : formatDuration(durationMinutes, t)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-end justify-between gap-2 pt-2 sm:pt-3 border-t border-border">
          <div className="min-w-0">
            {yourBid != null && (
              <p className="text-[10px] font-bold text-primary">{t.auction.yourBid}: {symbol}{yourBid.toFixed(2)}</p>
            )}
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">{t.auction[displayPriceKey(auction, status)]}</p>
            <p className="font-display text-lg sm:text-2xl font-extrabold text-primary truncate"><Money amount={displayPrice(auction, status)} codeClassName="opacity-60" /></p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] sm:text-xs font-bold text-primary-foreground bg-primary px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm shadow-primary/30 group-hover:gap-2 transition-all">
            <Gavel className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.auction.view}</span> <ArrowRight className={cn("w-3.5 h-3.5", arrowCls)} />
          </span>
        </div>
      </div>
    </Link>
  );
}