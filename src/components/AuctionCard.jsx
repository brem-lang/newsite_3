import React from "react";
import { Link } from "@tanstack/react-router";
import { Users, Clock, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency, Money } from "@/lib/currency";
import { formatCountdown, formatCountdownCompact, formatDuration, displayPrice, displayPriceKey } from "@/lib/auction";
import { useAuctionCountdown } from "@/lib/useAuctionCountdown";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import { useAuctionTaxonomy } from "@/lib/queries/config";
import { CategoryIcon } from "@/lib/categoryIcons";

export default function AuctionCard({ auction, yourBid }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const { status, remaining, durationMinutes } = useAuctionCountdown(auction);
  const filled = auction.subscriber_ids?.length || 0;
  const { categoryById, brandById } = useAuctionTaxonomy();
  const category = auction.category_id ? categoryById.get(auction.category_id) : null;
  const brand = auction.brand_id ? brandById.get(auction.brand_id) : null;
  const statusLabel = { open: t.auction.statusOpen, live: t.auction.statusLive, ended: t.auction.statusEnded }[status];
  const arrowCls = "";

  const badgeCls = status === "live"
    ? "theme-badge-live-soft"
    : status === "open"
      ? "theme-badge-open-soft"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Link to="/auction/$id" params={{ id: auction.id }} className="group relative block overflow-hidden rounded-xl border border-border bg-card shadow-[0_14px_32px_-24px_hsl(var(--accent)/0.45)] transition-all hover:-translate-y-1 hover:border-accent/45">
      <div className="absolute inset-0 overflow-hidden bg-muted">
        <Image src={auction.image_url} alt={auction.title} className="w-full h-full transition-transform duration-500 group-hover:scale-105" fittingType="fill" />
      </div>
      <div className="relative aspect-[16/9]">
        <span className={cn("absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-md border", badgeCls)}>
          {statusLabel}
        </span>
        <span className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-md bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.25)]">
          {symbol}{auction.entry_fee}
        </span>
      </div>
      <div className="photo-fade relative -mt-10 p-4 pt-10 space-y-3">
        <div className="space-y-1">
          {(category || brand) && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground truncate">
              {category && (
                <span className="inline-flex items-center gap-1" style={category.color ? { color: category.color } : undefined}>
                  <CategoryIcon icon={category.icon} className="w-3.5 h-3.5 text-xs" />
                  {category.name}
                </span>
              )}
              {category && brand && <span aria-hidden="true">·</span>}
              {brand && <span>{brand.name}</span>}
            </p>
          )}
          <h3 className="font-display font-bold text-base text-foreground leading-snug line-clamp-1">{auction.title}</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-accent" />{filled}/{auction.max_subscribers}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />{status === "live" ? formatCountdownCompact(remaining, t) : status === "ended" ? t.auction.statusEnded : formatDuration(durationMinutes, t)}</span>
        </div>
        <div className="flex items-end justify-between pt-3 border-t border-border/60">
          <div>
            {yourBid != null && (
              <p className="text-[10px] font-bold text-primary">{t.auction.yourBid}: {symbol}{yourBid.toFixed(2)}</p>
            )}
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.auction[displayPriceKey(auction, status)]}</p>
            <p className="font-display text-2xl font-extrabold text-primary"><Money amount={displayPrice(auction, status)} codeClassName="text-primary/60" /></p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-md group-hover:gap-2 transition-all">
            {t.auction.view} <ArrowRight className={cn("w-3.5 h-3.5", arrowCls)} />
          </span>
        </div>
      </div>
    </Link>
  );
}