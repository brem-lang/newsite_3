import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Coins, DollarSign, Download, Gavel, Package, Percent,
  RefreshCw, Search, Ticket, TrendingDown, TrendingUp, Trophy, Wallet
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const num = (n) => Number(n) || 0;
const abs = (n) => Math.abs(num(n));

/** wallet_transactions.type -> revenue bucket for this auction */
const FEE_TYPES = {
  subscription: "entryFees",
  bid_fee: "bidFees",
  bid_credits: "extraBids",
  winning_bid: "winnerPayment",
};

function Kpi({ icon: Icon, label, value, hint, tone = "default" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn(
        "mt-2 text-xl font-semibold tabular-nums",
        tone === "good" && "text-success",
        tone === "bad" && "text-destructive"
      )}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Per-auction profitability page: deposits made by its participants, every bid,
 * the fees the platform collected, the winner and what is still owed.
 */
export default function AdminAuctionPL() {
  const { t, dir } = useI18n();
  const { format, code } = useCurrency();
  const L = t.admin.auctionPl || {};
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  const [auctions, setAuctions] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const loadList = async () => {
    setListLoading(true);
    try {
      const rows = await base44.entities.Auction.listFields(
        "id,title,status,mode,winner_id,winner_name,subscriber_ids,entry_fee,cost_price,other_cost,created_date",
        "-created_date",
        400
      );
      setAuctions(rows || []);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const loadDetail = async (auctionId) => {
    setLoading(true);
    try {
      const auction = await base44.entities.Auction.get(auctionId);
      const seatIds = auction.subscriber_ids || [];
      const [bids, txns, costItems, override, winnerPays, people, deposits] = await Promise.all([
        base44.entities.Bid.filter({ auction_id: auctionId }, "-created_date", 3000).catch(() => []),
        base44.entities.WalletTransaction.filter({ auction_id: auctionId }, "-created_date", 3000).catch(() => []),
        base44.entities.AuctionCostItem.filter({ auction_id: auctionId }, "-created_date", 200).catch(() => []),
        base44.entities.AuctionFinanceOverride.filter({ auction_id: auctionId }, "-created_date", 1).catch(() => []),
        base44.entities.WinnerPayment.filter({ auction_id: auctionId }, "-created_date", 50).catch(() => []),
        seatIds.length
          ? base44.entities.User.filter({ id: seatIds }, "", seatIds.length).catch(() => [])
          : Promise.resolve([]),
        base44.entities.WalletTransaction.filter(
          { auction_id: auctionId, type: "deposit" }, "-created_date", 3000
        ).catch(() => []),
      ]);
      setDetail({
        auction,
        bids: bids || [],
        txns: txns || [],
        costItems: costItems || [],
        override: (override || [])[0] || null,
        winnerPays: winnerPays || [],
        people: people || [],
        deposits: deposits || [],
      });
      setRefreshedAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selected) loadDetail(selected); else setDetail(null); }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return auctions;
    return auctions.filter((a) =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.winner_name || "").toLowerCase().includes(q) ||
      (a.id || "").toLowerCase().includes(q)
    );
  }, [auctions, search]);

  /** Money model for the selected auction. */
  const model = useMemo(() => {
    if (!detail) return null;
    const { auction, bids, txns, costItems, override, deposits } = detail;
    const confirmed = txns.filter((x) => !x.status || x.status === "confirmed");

    const fees = { entryFees: 0, bidFees: 0, extraBids: 0, winnerPayment: 0, refunds: 0 };
    for (const x of confirmed) {
      const key = FEE_TYPES[x.type];
      if (key) fees[key] += abs(x.amount);
      else if (x.type === "refund") fees.refunds += abs(x.amount);
    }

    const incomeAdjust = num(override?.income_adjust);
    const income = fees.entryFees + fees.bidFees + fees.extraBids + fees.winnerPayment + incomeAdjust;

    const items = { entry: 0, bid: 0, other: 0, total: 0 };
    for (const i of costItems) {
      const kind = ["entry", "bid", "other"].includes(i.kind) ? i.kind : "other";
      items[kind] += abs(i.amount);
      items.total += abs(i.amount);
    }

    const hasWinner = !!(auction.winner_id || auction.winner_name);
    const productCost = hasWinner
      ? num(override?.cost_price ?? auction.cost_price)
      : 0;
    const otherCost = hasWinner ? num(override?.other_cost ?? auction.other_cost) : 0;
    const costs = productCost + otherCost + items.total + fees.refunds;
    const net = income - costs;

    const depositTotal = deposits
      .filter((d) => !d.status || d.status === "confirmed")
      .reduce((s, d) => s + abs(d.amount), 0);
    const depositPending = deposits
      .filter((d) => d.status === "pending")
      .reduce((s, d) => s + abs(d.amount), 0);

    const liveBids = bids.filter((b) => !b.archived);
    const burned = liveBids.filter((b) => b.burned).length;

    // Per-participant roll-up: bids placed, fees paid, deposits funded.
    const byUser = new Map();
    const seat = (id) => {
      if (!byUser.has(id)) byUser.set(id, { userId: id, bids: 0, burned: 0, fees: 0, deposits: 0, last: null });
      return byUser.get(id);
    };
    for (const id of auction.subscriber_ids || []) seat(id);
    for (const b of liveBids) {
      const s = seat(b.user_id);
      s.bids += 1;
      if (b.burned) s.burned += 1;
      if (!s.last || new Date(b.created_date) > new Date(s.last)) s.last = b.created_date;
    }
    for (const x of confirmed) {
      if (!FEE_TYPES[x.type]) continue;
      seat(x.user_id).fees += abs(x.amount);
    }
    for (const d of deposits) {
      if (d.status && d.status !== "confirmed") continue;
      seat(d.user_id).deposits += abs(d.amount);
    }
    const nameOf = new Map(detail.people.map((p) => [p.id, p.full_name || p.email || p.id]));
    const seats = [...byUser.values()]
      .map((s) => ({ ...s, name: nameOf.get(s.userId) || s.userId }))
      .sort((a, b) => b.fees - a.fees || b.bids - a.bids);

    const winnerPay = detail.winnerPays[0] || null;
    const awaiting = winnerPay && winnerPay.status !== "paid" ? num(winnerPay.amount) : 0;

    return {
      auction, fees, incomeAdjust, income, items, productCost, otherCost, costs, net,
      margin: income > 0 ? (net / income) * 100 : 0,
      roi: costs > 0 ? (net / costs) * 100 : null,
      depositTotal, depositPending,
      bidCount: liveBids.length, burned, archivedBids: bids.length - liveBids.length,
      seats, hasWinner, winnerPay, awaiting,
      incomePerSeat: seats.length ? income / seats.length : 0,
    };
  }, [detail]);

  const exportCsv = () => {
    if (!model) return;
    const head = ["metric", "value"];
    const rows = [
      ["auction_id", model.auction.id],
      ["title", model.auction.title || ""],
      ["status", model.auction.status || ""],
      ["mode", model.auction.mode || ""],
      ["participants", model.seats.length],
      ["participant_deposits", model.depositTotal.toFixed(2)],
      ["entry_fees", model.fees.entryFees.toFixed(2)],
      ["bid_fees", model.fees.bidFees.toFixed(2)],
      ["extra_bids", model.fees.extraBids.toFixed(2)],
      ["winner_payment", model.fees.winnerPayment.toFixed(2)],
      ["refunds", model.fees.refunds.toFixed(2)],
      ["gross_income", model.income.toFixed(2)],
      ["product_cost", model.productCost.toFixed(2)],
      ["other_cost", model.otherCost.toFixed(2)],
      ["cost_items", model.items.total.toFixed(2)],
      ["total_cost", model.costs.toFixed(2)],
      ["net_profit", model.net.toFixed(2)],
      ["margin_pct", model.margin.toFixed(1)],
      ["bids", model.bidCount],
      ["burned_bids", model.burned],
      ["winner", model.auction.winner_name || ""],
      ["awaiting_winner_payment", model.awaiting.toFixed(2)],
    ];
    const csv = [head.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auction-pl-${model.auction.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------- list view ------------------------------ */
  if (!selected) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">{L.title || "Auction profit & loss"}</h2>
          <p className="text-sm text-muted-foreground">
            {L.subtitle || "Pick an auction to see its deposits, bids, fees and winner in one place."}
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.searchPlaceholder || "Search by title, winner or ID"}
            className="ps-9"
          />
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {listLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{L.empty || "No auctions found."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setSelected(a.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-secondary/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.title || a.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(a.subscriber_ids || []).length} {L.participants || "participants"}
                        {a.winner_name ? ` · ${L.winner || "Winner"}: ${a.winner_name}` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] uppercase">{a.status}</Badge>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(a.created_date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ detail view ----------------------------- */
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Back className="w-3.5 h-3.5" />{L.backToList || "All auctions"}
          </button>
          <h2 className="mt-1 font-display text-xl font-semibold truncate">
            {model?.auction.title || (L.title || "Auction profit & loss")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {model ? `${model.auction.status} · ${model.auction.mode}` : "…"}
            {refreshedAt && <span className="ms-1 opacity-70">· {formatDateTime(refreshedAt)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadDetail(selected)} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 me-1.5", loading && "animate-spin")} />
            {t.common?.refresh || "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!model}>
            <Download className="w-4 h-4 me-1.5" />CSV
          </Button>
        </div>
      </div>

      {!model ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={Wallet}
              label={L.deposits || "Participant deposits"}
              value={format(model.depositTotal)}
              hint={model.depositPending > 0 ? `${L.pending || "Pending"} ${format(model.depositPending)}` : `${code} · ${L.confirmed || "confirmed"}`}
            />
            <Kpi
              icon={DollarSign}
              label={L.grossIncome || "Gross income"}
              value={format(model.income)}
              hint={`${L.incomePerSeat || "Per participant"} ${format(model.incomePerSeat)}`}
            />
            <Kpi
              icon={Package}
              label={L.totalCost || "Total cost"}
              value={format(model.costs)}
              tone="bad"
              hint={`${L.productCost || "Product"} ${format(model.productCost)} · ${L.refunds || "Refunds"} ${format(model.fees.refunds)}`}
            />
            <Kpi
              icon={model.net >= 0 ? TrendingUp : TrendingDown}
              label={L.netProfit || "Net profit"}
              value={format(model.net)}
              tone={model.net >= 0 ? "good" : "bad"}
              hint={`${L.margin || "Margin"} ${model.margin.toFixed(1)}%${model.roi === null ? "" : ` · ROI ${model.roi.toFixed(1)}%`}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Ticket} label={L.entryFees || "Entry fees"} value={format(model.fees.entryFees)} />
            <Kpi icon={Gavel} label={L.bidFees || "Bid fees"} value={format(model.fees.bidFees)} hint={`${model.bidCount} ${L.bids || "bids"} · ${model.burned} ${L.burned || "burned"}`} />
            <Kpi icon={Coins} label={L.extraBids || "Extra bids sold"} value={format(model.fees.extraBids)} />
            <Kpi icon={Percent} label={L.winnerPayment || "Winner payment"} value={format(model.fees.winnerPayment)} hint={model.awaiting > 0 ? `${L.awaiting || "Awaiting"} ${format(model.awaiting)}` : undefined} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-warning" />
              <h3 className="font-semibold">{L.winner || "Winner"}</h3>
            </div>
            {model.hasWinner ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">{L.winner || "Winner"}</p>
                  <p className="text-sm font-medium">{model.auction.winner_name || model.auction.winner_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{L.winnerPayment || "Winner payment"}</p>
                  <p className="text-sm font-medium tabular-nums">
                    {model.winnerPay ? format(num(model.winnerPay.amount)) : format(model.fees.winnerPayment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{L.paymentStatus || "Payment status"}</p>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "mt-0.5 text-[10px]",
                      model.winnerPay?.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    )}
                  >
                    {model.winnerPay?.status || (model.fees.winnerPayment > 0 ? "paid" : "pending")}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{L.noWinner || "This auction has no winner yet, so product cost is not counted."}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">{L.perParticipant || "Per participant"}</h3>
              <p className="text-xs text-muted-foreground">
                {L.perParticipantHint || "Bids placed, fees collected and wallet deposits for every seat."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-start font-medium px-4 py-2">{L.participant || "Participant"}</th>
                    <th className="text-end font-medium px-4 py-2">{L.bids || "Bids"}</th>
                    <th className="text-end font-medium px-4 py-2">{L.burned || "Burned"}</th>
                    <th className="text-end font-medium px-4 py-2">{L.feesPaid || "Fees paid"}</th>
                    <th className="text-end font-medium px-4 py-2">{L.deposits || "Deposits"}</th>
                    <th className="text-end font-medium px-4 py-2">{L.lastBid || "Last bid"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {model.seats.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">{L.noSeats || "No participants yet."}</td></tr>
                  ) : model.seats.map((s) => (
                    <tr key={s.userId}>
                      <td className="px-4 py-2 truncate max-w-[220px]">{s.name}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{s.bids}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-warning">{s.burned || "—"}</td>
                      <td className="px-4 py-2 text-end tabular-nums">{format(s.fees)}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-muted-foreground">{format(s.deposits)}</td>
                      <td className="px-4 py-2 text-end text-xs text-muted-foreground">{s.last ? formatDateTime(s.last) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
