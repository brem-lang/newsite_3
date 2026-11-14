import React from "react";
import { CheckCircle2, Wallet, Zap, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Screen 06 — bid review and confirmation.
 * The amount the participant typed is shown one more time with the bid fee,
 * the wallet balance and the bids left, before the bid is actually saved.
 */
export default function BidConfirm({
  auction, amount, balance, bidState, loading, placed, onConfirm, onCancel, onClose,
}) {
  const { lang } = useI18n();
  const copy = lang === "ar"
    ? {
        review: "تأكيد المزايدة",
        yourBid: "مزايدتك",
        fee: "رسوم المزايدة",
        free: "مجاناً",
        balance: "رصيد المحفظة",
        left: "المزايدات المتبقية",
        confirm: "تأكيد المزايدة",
        cancel: "رجوع",
        saving: "جارٍ الحفظ...",
        done: "تم حفظ مزايدتك",
        doneHint: "ستظهر مزايدتك في المزاد فوراً.",
        close: "إغلاق",
      }
    : {
        review: "Confirm your bid",
        yourBid: "Your bid",
        fee: "Bid fee",
        free: "Free",
        balance: "Wallet balance",
        left: "Bids left",
        confirm: "Confirm bid",
        cancel: "Back",
        saving: "Saving...",
        done: "Your bid is saved",
        doneHint: "It now appears on the auction straight away.",
        close: "Close",
      };

  const fee = Number(auction?.bid_fee || 0);
  const used = Array.isArray(bidState?.mine) ? bidState.mine.length : 0;
  const baseQuota = Math.max(0, Number(auction?.bids_per_participant ?? 0));
  const quota = baseQuota ? baseQuota + Math.max(0, Number(bidState?.credits || 0)) : 0;
  const left = quota ? Math.max(0, quota - used) : null;

  if (placed) {
    return (
      <div className="space-y-4 py-2 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold text-foreground">{copy.done}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{copy.doneHint}</p>
        </div>
        <Money amount={amount} className="block font-display text-3xl font-extrabold text-primary" />
        <Button onClick={onClose} className="gold-button h-12 w-full rounded-xl font-bold">{copy.close}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center shadow-[0_0_28px_-12px_hsl(var(--primary)/0.6)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{copy.yourBid}</p>
        <Money amount={amount} className="mt-1 block font-display text-[34px] font-extrabold leading-none text-primary" />
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <Gavel className="h-3.5 w-3.5" /> {copy.fee}: {fee > 0 ? <Money amount={fee} /> : copy.free}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-accent">
            <Wallet className="h-3.5 w-3.5" /> {copy.balance}
          </p>
          <Money amount={Number(balance || 0)} className="mt-1 block font-display text-base font-extrabold text-foreground" />
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
          <p className="text-[10px] font-bold uppercase text-accent">{copy.left}</p>
          <p className={cn("mt-1 font-display text-base font-extrabold tabular-nums text-foreground")}>
            {left === null ? "∞" : left}
          </p>
        </div>
      </div>

      <Button
        onClick={onConfirm}
        disabled={loading}
        className="gold-button h-13 min-h-[52px] w-full gap-2 rounded-2xl text-[15px] font-bold active:scale-[0.98]"
      >
        {loading ? copy.saving : <span className="flex items-center gap-2"><Zap className="h-4 w-4" />{copy.confirm}</span>}
      </Button>
      <Button variant="outline" onClick={onCancel} disabled={loading} className="h-11 w-full rounded-xl font-bold">
        {copy.cancel}
      </Button>
    </div>
  );
}
