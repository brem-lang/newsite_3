import React from "react";
import { Gavel, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BidPanel({ subscribed, status, nextBid, bidIncrement, bidAmount, setBidAmount, onBid, actionLoading, maxBid, setMaxBid }) {
  const { t } = useI18n();
  if (!subscribed || status === "ended") return null;
  const base = bidAmount || nextBid;
  const chips = [
    { label: t.auction.chipMin, value: nextBid },
    { label: "+1", value: base + 1 },
    { label: "+5", value: base + 5 },
    { label: "+10", value: base + 10 }
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t.auction.yourBid}</span>
        <span className="text-xs text-muted-foreground">{t.auction.minBid}: {t.common.currency}{nextBid.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <Button
            key={c.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBidAmount(Number(c.value.toFixed(2)))}
            className="h-10 px-2 text-xs"
          >
            {c.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="number"
          min={nextBid}
          step={bidIncrement}
          value={bidAmount}
          onChange={(e) => setBidAmount(Number(e.target.value))}
          className="h-12 text-lg font-bold"
        />
        <Button onClick={onBid} disabled={actionLoading} className="h-12 w-full sm:w-auto px-6 font-bold gap-2">
          {actionLoading ? t.auction.bidding : <span className="flex items-center gap-2"><Gavel className="w-4 h-4" /> {t.auction.placeBid}</span>}
        </Button>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /> {t.auction.maxBid}</label>
        <Input
          type="number"
          min={0}
          step={bidIncrement}
          value={maxBid}
          onChange={(e) => setMaxBid(Number(e.target.value) || 0)}
          placeholder="0.00"
          className="h-10"
        />
        <p className="text-[11px] text-muted-foreground">{t.auction.maxBidHint}</p>
      </div>
    </div>
  );
}