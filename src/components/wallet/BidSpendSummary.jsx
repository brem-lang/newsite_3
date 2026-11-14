import React from "react";
import { Ticket, Gavel, ShoppingCart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

const abs = (n) => Math.abs(Number(n) || 0);

/**
 * What the wallet actually paid for bidding: entry fees, per-bid fees and
 * extra numbers bought, with how many of each. Derived from the same
 * transaction list the balance is computed from.
 */
export default function BidSpendSummary({ transactions = [], compact = false }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const L = t.wallet || {};

  const rows = (transactions || []).filter((x) => x.status !== "pending" && x.status !== "failed");
  const bucket = (type) => {
    const list = rows.filter((x) => x.type === type);
    return { total: list.reduce((s, x) => s + abs(x.amount), 0), count: list.length };
  };
  const entry = bucket("subscription");
  const fees = bucket("bid_fee");
  const extra = bucket("bid_credits");
  const total = entry.total + fees.total + extra.total;
  if (total === 0) return null;

  const cells = [
    { icon: Ticket, label: L.spendEntry || "Entry fees", value: entry.total, count: entry.count },
    { icon: Gavel, label: L.spendBidFees || "Bid fees", value: fees.total, count: fees.count },
    { icon: ShoppingCart, label: L.spendExtra || "Extra bids", value: extra.total, count: extra.count },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {L.spendTitle || "Spent on bidding"}
        </p>
        <p className="text-sm font-bold tabular-nums" dir="ltr">{symbol}{total.toFixed(2)}</p>
      </div>
      <div className={compact ? "mt-3 grid grid-cols-3 gap-2" : "mt-3 grid grid-cols-3 gap-3"}>
        {cells.map(({ icon: Icon, label, value, count }) => (
          <div key={label} className="rounded-xl bg-muted/40 p-2.5 text-center">
            <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground" />
            <p className="mt-1 text-sm font-bold tabular-nums" dir="ltr">{symbol}{value.toFixed(2)}</p>
            <p className="text-[10px] font-semibold text-muted-foreground leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {count} {L.spendCount || "times"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
