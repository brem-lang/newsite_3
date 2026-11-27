import React from "react";
import { Lock, Flame, Send, CheckCircle2, Plus, Minus, ShoppingCart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sealedStep, snapToStep } from "@/lib/auction";

/**
 * Sealed "closest to the price" console: the user submits unique numbers up to
 * the selling price. Other participants' active numbers are never shown — only
 * the public burned list and the user's own numbers.
 */
export default function SealedBidPanel({
  auction,
  bidState,
  bidAmount,
  setBidAmount,
  onBid,
  actionLoading,
  symbol = "₱",
  compact = false,
  onBuyCredits,
  buyingCredits = false,
  balance = null,
}) {
  const { t } = useI18n();
  
  const [extraCount, setExtraCount] = React.useState(1);
  const target = Number(auction?.target_price || 0);
  const step = sealedStep(auction);
  const burned = bidState?.burned || [];
  const mine = bidState?.mine || [];
  const fee = Number(auction?.bid_fee || 0);
  const fmt = (n) => Number(n).toFixed(2);
  // Every participant gets the same number of picks; the counter mirrors the
  // quota enforced inside the database bid function.
  // 0 numbers per participant means "no cap": people bid as long as their
  // wallet can pay the fee per bid.
  const unlimited = Number(auction?.bids_per_participant ?? 5) === 0;
  const baseQuota = unlimited ? 0 : Math.max(1, Number(auction?.bids_per_participant ?? 5));
  // Extra numbers bought from the wallet stack on top of the free quota.
  const credits = Math.max(0, Number(bidState?.credits || 0));
  const quota = baseQuota + credits;
  const extraPrice = Number(bidState?.extra_bid_price ?? auction?.extra_bid_price ?? 0);
  const used = mine.length;
  const quotaReached = !unlimited && used >= quota;
  const canBuy = !unlimited && extraPrice > 0 && typeof onBuyCredits === "function";
  const remaining = unlimited ? Infinity : Math.max(0, quota - used);
  const clampCount = (n) => Math.max(1, Math.min(50, Math.floor(Number(n) || 1)));
  // Pool of still-free numbers. The auction's timer shortens as it empties, so
  // the round always ends while a unique number is still standing.
  const totalNumbers = Number(bidState?.total_numbers || 0);
  const freeNumbers = Number(bidState?.free_numbers || 0);
  const nf = (n) => Number(n).toLocaleString("en-GB");
  const poolPct = totalNumbers > 0 ? Math.max(0, Math.min(100, (freeNumbers / totalNumbers) * 100)) : 100;




  return (
    <div className="space-y-4">
      {/* Header: title + fee state — native-app row that never wraps */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t.auction.sealedTitle}</span>
        </span>
        {fee > 0 ? (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {t.auction.sealedFee || "Fee per bid"}: {symbol}{fmt(fee)}
          </span>
        ) : (
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold",
            remaining > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}>
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            {unlimited
              ? (t.auction.sealedUnlimitedBadge || "Unlimited bids — your balance is the limit")
              : (t.auction.sealedRemainingBadge || "{n} bids left").replace("{n}", nf(remaining))}
          </span>
        )}
      </div>

      {/* Native-app style stat strip: picks used / left / selling price */}
      <div className="native-panel grid grid-cols-3 divide-x divide-border rounded-xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-3 px-1 text-center">
          <p className={cn("text-lg font-extrabold tabular-nums leading-none", quotaReached ? "text-muted-foreground" : "text-accent")}>
            {used}{unlimited ? null : <span className="text-xs font-bold text-muted-foreground">/{quota}</span>}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
            {t.auction.sealedPicksShort || "Your numbers"}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-3 px-1 text-center">
          <p className={cn("text-lg font-extrabold tabular-nums leading-none", remaining === 0 ? "text-muted-foreground" : "text-foreground")} dir="ltr">
            {unlimited ? "∞" : remaining}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
            {t.auction.sealedLeftShort || "Left to submit"}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-3 px-1 text-center">
          <p className="text-lg font-extrabold tabular-nums leading-none text-foreground" dir="ltr">
          {symbol}{fmt(target)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
            {t.auction.sealedTarget || "Selling price"}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="number"
          min={step}
          max={target || undefined}
          step={step}
          value={bidAmount}
          disabled={quotaReached}
          onChange={(e) => setBidAmount(e.target.value)}
          onBlur={(e) => {
            const snapped = snapToStep(auction, e.target.value);
            if (snapped && snapped !== e.target.value) setBidAmount(snapped);
          }}
          placeholder={t.auction.sealedYourNumber}
          className="h-12 text-lg font-bold"
        />
        <Button
          onClick={onBid}
          disabled={actionLoading || quotaReached}
          className="cyan-button h-12 w-full sm:w-auto px-6 font-bold gap-2"
        >
          {actionLoading ? t.auction.bidding : <span className="flex items-center gap-2"><Send className="w-4 h-4" />{t.auction.sealedSubmit}</span>}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {(t.auction.sealedHint || "").replace("{target}", `${symbol}${fmt(target)}`)}{" "}
        {(t.auction.sealedStepHint || "").replace("{step}", `${symbol}${fmt(step)}`)}{" "}
        {t.auction.sealedFairHint || ""}{" "}
        {fee > 0
          ? (t.auction.sealedFeeHint || "Each number you submit costs {fee} from your wallet.").replace("{fee}", `${symbol}${fmt(fee)}`)
          : (t.auction.sealedFreeHint || "Submitting numbers is completely free — your wallet balance is never charged for a bid.")}
      </p>

      {totalNumbers > 0 && (
        <div className="native-panel rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {(t.auction.poolFree || "Free numbers: {free} of {total}")
                .replace("{free}", nf(freeNumbers))
                .replace("{total}", nf(totalNumbers))}
            </p>
            <span className="text-[11px] font-bold text-muted-foreground" dir="ltr">
              {Math.round(poolPct)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", poolPct < 20 ? "bg-primary/100" : "bg-accent")}
              style={{ width: `${poolPct}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 py-1.5">
              <p className="text-sm font-bold tabular-nums text-foreground">{nf(totalNumbers)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.auction.poolTotal || "Total"}</p>
            </div>
            <div className="rounded-lg bg-success/10 py-1.5">
              <p className="text-sm font-bold tabular-nums text-success">{nf(freeNumbers)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-success">{t.auction.poolFreeShort || "Free"}</p>
            </div>
            <div className="rounded-lg bg-primary/10 py-1.5">
              <p className="text-sm font-bold tabular-nums text-primary">{nf(burned.length)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{t.auction.poolBurnedShort || "Burned"}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t.auction.poolHint ||
              "The fewer free numbers remain, the sooner this auction closes — the timer shortens as the pool empties."}
          </p>

        </div>
      )}



      {canBuy && (
        <div className={cn(
          "rounded-xl border p-3",
          quotaReached ? "border-accent/35 bg-accent/10" : "border-border bg-card"
        )}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-accent" />
              {t.auction.buyBidsTitle || "Buy extra numbers"}
            </p>
            <span className="text-[11px] font-bold text-muted-foreground">
              {(t.auction.buyBidsPrice || "{price} each").replace("{price}", `${symbol}${fmt(extraPrice)}`)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card">
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label="minus"
                onClick={() => setExtraCount((c) => clampCount(c - 1))}
                className="h-10 w-10 rounded-lg"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={50}
                value={extraCount}
                onChange={(e) => setExtraCount(clampCount(e.target.value))}
                className="h-10 w-14 border-0 text-center text-base font-bold bg-transparent text-foreground focus-visible:ring-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label="plus"
                onClick={() => setExtraCount((c) => clampCount(c + 1))}
                className="h-10 w-10 rounded-lg"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              disabled={buyingCredits}
              onClick={() => onBuyCredits?.(clampCount(extraCount))}
              className="cyan-button h-10 flex-1 font-bold gap-2 disabled:opacity-60"
            >
              {(t.auction.buyBidsCta || "Buy {count} for {total}")
                .replace("{count}", String(clampCount(extraCount)))
                .replace("{total}", `${symbol}${fmt(extraPrice * clampCount(extraCount))}`)}
            </Button>
          </div>
          {balance !== null && (
            <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
              {(t.auction.buyBidsBalance || "Balance {balance} -> {after} after purchase")
                .replace("{balance}", `${symbol}${fmt(balance)}`)
                .replace("{after}", `${symbol}${fmt(Math.max(0, Number(balance) - extraPrice * clampCount(extraCount)))}`)}
            </p>
          )}
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {credits > 0
              ? (t.auction.buyBidsOwned || "You bought {credits} extra numbers for this round.").replace("{credits}", String(credits))
              : (t.auction.buyBidsHint || "Once your free numbers are used you can buy more from your wallet balance.")}
          </p>
        </div>
      )}

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
         <div className="native-panel rounded-xl p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> {t.auction.sealedMine}
          </p>
          {mine.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.auction.sealedMineEmpty}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {mine.map((m, i) => (
                <span
                  key={`${m.amount}-${i}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                     m.burned ? "bg-muted text-muted-foreground line-through" : "bg-accent/10 text-accent"
                  )}
                  title={m.burned ? t.auction.sealedBurnedTag : t.auction.sealedActive}
                >
                  {symbol}{fmt(m.amount)}
                </span>
              ))}
            </div>
          )}
        </div>

         <div className="native-panel rounded-xl p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-primary" /> {t.auction.sealedBurned}
            {burned.length > 0 && <span className="font-normal text-muted-foreground">({burned.length})</span>}
          </p>
          {burned.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.auction.sealedBurnedEmpty}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {burned.map((n) => (
                <span key={n} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary line-through">
                  {symbol}{fmt(n)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
