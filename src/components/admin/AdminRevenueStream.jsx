import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowUpRight, Gavel, Ticket, Trophy, Wallet, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Live revenue stream.
 *
 * Money is only ever charged, never reserved: the old escrow model is gone.
 * So instead of an "escrow balance" per auction we show "awaiting payment" —
 * the winner amount that has been invoiced through a payment link but is not
 * settled yet. Everything else (entry fees, bid fees, extra bids, winner
 * payments collected) is real money already in the wallet ledger.
 */
const INCOME_TYPES = new Set(["subscription", "bid_fee", "bid_credits", "winning_bid"]);
const DEPOSIT_TYPES = new Set(["topup", "deposit"]);

const abs = (n) => Math.abs(Number(n) || 0);

export default function AdminRevenueStream() {
  const { lang } = useI18n();
  const { format } = useCurrency();
  const L = (en, ar) => (lang === "ar" ? ar : en);

  const [txns, setTxns] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [pending, setPending] = useState([]);
  const [pulse, setPulse] = useState(0);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const [tx, au, wp] = await Promise.all([
      base44.entities.WalletTransaction.list("-created_date", 400).catch(() => []),
      base44.entities.Auction.listFields("id, title, status, round", "-created_date", 300).catch(() => []),
      base44.entities.WinnerPayment.list().then((rows) => (rows || []).filter((p) => p.status !== "paid")).catch(() => []),
    ]);
    setTxns(tx || []);
    setAuctions(au || []);
    setPending(wp || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Realtime: any wallet movement or bid nudges a coalesced reload. */
  useEffect(() => {
    const bump = () => {
      setPulse((p) => p + 1);
      if (timer.current) return;
      timer.current = setTimeout(() => { timer.current = null; load(); }, 800);
    };
    const unsubs = [
      base44.entities.WalletTransaction.subscribe(bump),
      base44.entities.Bid.subscribe(bump),
    ];
    const poll = setInterval(load, 20000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [load]);

  const titleOf = useMemo(() => {
    const map = new Map((auctions || []).map((a) => [a.id, a]));
    return (id) => map.get(id) || null;
  }, [auctions]);

  const awaitingByAuction = useMemo(() => {
    const map = new Map();
    for (const p of pending || []) map.set(p.auction_id, (map.get(p.auction_id) || 0) + abs(p.amount));
    return map;
  }, [pending]);

  const rows = useMemo(() => {
    const by = new Map();
    for (const x of txns || []) {
      if (!x.auction_id) continue;
      if (x.status === "failed") continue;
      const g = by.get(x.auction_id) || { entry: 0, bidFees: 0, extra: 0, winner: 0, refunds: 0, events: 0, last: null };
      if (x.status === "confirmed") {
        if (x.type === "subscription") g.entry += abs(x.amount);
        else if (x.type === "bid_fee") g.bidFees += abs(x.amount);
        else if (x.type === "bid_credits") g.extra += abs(x.amount);
        else if (x.type === "winning_bid") g.winner += abs(x.amount);
        else if (x.type === "refund") g.refunds += abs(x.amount);
      }
      g.events += 1;
      if (!g.last || new Date(x.created_date) > new Date(g.last)) g.last = x.created_date;
      by.set(x.auction_id, g);
    }
    for (const [id, amount] of awaitingByAuction) {
      const g = by.get(id) || { entry: 0, bidFees: 0, extra: 0, winner: 0, refunds: 0, events: 0, last: null };
      g.awaiting = amount;
      by.set(id, g);
    }
    return [...by.entries()]
      .map(([id, g]) => {
        const income = g.entry + g.bidFees + g.extra + g.winner - g.refunds;
        return { id, auction: titleOf(id), awaiting: g.awaiting || 0, income, ...g };
      })
      .sort((a, b) => (b.income + b.awaiting) - (a.income + a.awaiting))
      .slice(0, 12);
  }, [txns, awaitingByAuction, titleOf]);

  const totals = useMemo(() => {
    let income = 0, deposits = 0, refunds = 0, awaiting = 0;
    for (const x of txns || []) {
      if (x.status !== "confirmed") continue;
      if (INCOME_TYPES.has(x.type)) income += abs(x.amount);
      else if (DEPOSIT_TYPES.has(x.type)) deposits += abs(x.amount);
      else if (x.type === "refund") refunds += abs(x.amount);
    }
    for (const [, v] of awaitingByAuction) awaiting += v;
    return { income, deposits, refunds, awaiting };
  }, [txns, awaitingByAuction]);

  const feed = useMemo(() => (txns || []).slice(0, 12), [txns]);

  const LABELS = {
    subscription: [L("Entry fee", "رسوم دخول"), Ticket, "text-info"],
    bid_fee: [L("Bid fee", "رسوم مزايدة"), Gavel, "text-info"],
    bid_credits: [L("Extra bids", "مزايدات إضافية"), Gavel, "text-primary"],
    winning_bid: [L("Winner payment", "دفعة فائز"), Trophy, "text-success"],
    refund: [L("Refund", "استرداد"), ArrowUpRight, "text-destructive"],
    topup: [L("Deposit", "إيداع"), Wallet, "text-info"],
    deposit: [L("Deposit", "إيداع"), Wallet, "text-info"],
  };

  const time = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const Stat = ({ icon: Icon, label, value, hint, tone }) => (
    <div className="rounded-xl border border-accent/15 bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /><span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="native-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {L("Live revenue stream", "تدفق الإيرادات المباشر")}
          <span className="relative inline-flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-success animate-ping" />
            <span className="absolute inset-0 rounded-full bg-success" />
          </span>
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {L(`Last 400 movements · ${pulse} live updates`, `آخر 400 حركة · ${pulse} تحديث مباشر`)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Wallet} label={L("Deposits", "الإيداعات")} value={format(totals.deposits)} hint={L("Money into wallets", "أموال داخلة للمحافظ")} />
        <Stat icon={Gavel} label={L("Auction income", "إيرادات المزادات")} value={format(totals.income)} tone="text-success" hint={L("Entry, bid fees, extra bids, wins", "دخول، رسوم مزايدة، مزايدات إضافية، مكاسب")} />
        <Stat icon={Clock} label={L("Awaiting winner payment", "بانتظار دفع الفائز")} value={format(totals.awaiting)} tone="text-warning" hint={L("Invoiced, not settled yet", "تم إصدار الفاتورة ولم تُسدد")} />
        <Stat icon={ArrowUpRight} label={L("Refunds", "الاستردادات")} value={format(totals.refunds)} tone="text-destructive" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-accent/20 overflow-hidden bg-background/35">
          <div className="px-3 py-2 text-[11px] font-medium text-accent bg-accent/10">
            {L("Per auction", "لكل مزاد")}
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
            {rows.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">{L("No auction money yet.", "لا توجد حركة مالية بعد.")}</p>
            )}
            {rows.map((r) => (
              <div key={r.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{r.auction?.title || r.id.slice(0, 8)}</p>
                  <span className="text-xs font-semibold tabular-nums text-success">{format(r.income)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
                  <span>{L("Entry", "دخول")} {format(r.entry)}</span>
                  <span>{L("Bids", "مزايدات")} {format(r.bidFees + r.extra)}</span>
                  <span>{L("Wins", "مكاسب")} {format(r.winner)}</span>
                  {r.refunds > 0 && <span className="text-destructive">{L("Refunds", "استرداد")} {format(r.refunds)}</span>}
                  {r.awaiting > 0 && (
                    <span className="text-warning font-medium">{L("Awaiting", "بانتظار")} {format(r.awaiting)}</span>
                  )}
                  {r.auction?.status && <span className="uppercase">{r.auction.status}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-accent/20 overflow-hidden bg-background/35">
          <div className="px-3 py-2 text-[11px] font-medium text-accent bg-accent/10">
            {L("Latest movements", "أحدث الحركات")}
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
            {feed.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">{L("Nothing yet.", "لا شيء بعد.")}</p>
            )}
            {feed.map((x) => {
              const [label, Icon, tone] = LABELS[x.type] || [x.type, Activity, "text-muted-foreground"];
              const a = x.auction_id ? titleOf(x.auction_id) : null;
              return (
                <div key={x.id} className="flex items-center gap-2 p-2.5">
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", tone)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">
                      {label}
                      {a?.title ? <span className="text-muted-foreground"> · {a.title}</span> : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {time(x.created_date)}
                      {x.status && x.status !== "confirmed" ? ` · ${x.status}` : ""}
                    </p>
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums", Number(x.amount) < 0 ? "text-success" : "text-info")}>
                    {format(abs(x.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
