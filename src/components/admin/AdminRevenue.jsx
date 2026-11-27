import React, { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Ticket, Gavel, Coins, Package,
  RefreshCw, Download, ChevronDown, ChevronRight, Percent, PhilippinePeso
} from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useAdminData, adminSection, adminRpc, fetchAllRows, warmAdmin } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import AuctionFinancePanel from "@/components/admin/AuctionFinancePanel";
import SelectField from "@/components/ui/select-field";

/**
 * Revenue model, per auction and in total.
 *
 * Income (money that lands with the platform, taken from participant wallets):
 *   entry fees     -> wallet_transactions.type = "subscription"
 *   bid fees       -> "bid_fee"        (closest-price auctions with a per-bid fee)
 *   extra bids     -> "bid_credits"    (participants buying more numbers)
 *   winner payment -> "winning_bid"    (charged at settlement)
 * Money out:
 *   product cost   -> auctions.cost_price   (only counted once a winner exists)
 *   other cost     -> auctions.other_cost   (shipping / handling / fees)
 *   refunds        -> "refund" transactions tied to the auction
 *
 * Net profit = income - costs - refunds.  Margin = net / income.
 */

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const abs = (n) => Math.abs(Number(n) || 0);
const num = (n) => Number(n) || 0;

const RANGES = [
  { id: "7", days: 7 },
  { id: "30", days: 30 },
  { id: "90", days: 90 },
  { id: "all", days: null }
];

const NONE = [];

/** Local midnight at the start of the range (null = all time). */
const sinceFor = (range) => {
  const r = RANGES.find((x) => x.id === range);
  if (!r?.days) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (r.days - 1));
  return d;
};
const DEFAULT_RANGE = "30";

/**
 * The ledger is summed in Postgres (admin_revenue_by_auction / _daily), so no
 * transaction rows are downloaded. Auctions and their cost lines are read in
 * full (batched), since every auction gets a row in this report.
 */
const loadSection = async (range) => {
  const since = sinceFor(range);
  const trendSince = since || sinceFor("30"); // "all" still charts the last 30 days
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [a, sums, daily, ci, ov] = await Promise.all([
    // Test-mode auctions are not business: the report leaves them out.
    fetchAllRows("Auction", { sort: "-created_date", where: { is_test: false } }),
    adminRpc("admin_revenue_by_auction", { _since: since ? since.toISOString() : null }),
    adminRpc("admin_revenue_daily", { _since: trendSince.toISOString(), _tz: tz }),
    fetchAllRows("AuctionCostItem", { sort: "-created_date" }).catch(() => []),
    fetchAllRows("AuctionFinanceOverride", { sort: "-created_date" }).catch(() => []),
  ]);
  return { auctions: a || [], sums: sums || [], daily: daily || [], costItems: ci || [], overrides: ov || [] };
};
const revenueQuery = (range) => adminSection(adminKeys.revenueReport(range), () => loadSection(range), { placeholderData: keepPreviousData });

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, revenueQuery(DEFAULT_RANGE));

export default function AdminRevenue() {
  const { t } = useI18n();
  const { format, code } = useCurrency();
  const [range, setRange] = useState(DEFAULT_RANGE);
  // One cached report per range (ledger summed in SQL); filters/sorting below are in-memory over auctions.
  const { data, isPending: loading, isFetching: refreshing, refresh, dataUpdatedAt } = useAdminData(
    adminKeys.revenueReport(range), () => loadSection(range), { placeholderData: keepPreviousData },
  );
  const auctions = data?.auctions ?? NONE;
  const sums = data?.sums ?? NONE;
  const daily = data?.daily ?? NONE;
  const costItems = data?.costItems ?? NONE;
  const overrides = data?.overrides ?? NONE;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("net");
  const [expanded, setExpanded] = useState(null);
  const refreshedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const load = () => refresh();

  /** Per-auction revenue rows. Income/refund sums are confirmed transactions in the range, summed on the server. */
  const rows = useMemo(() => {
    const blank = () => ({ entryFees: 0, bidFees: 0, extraBids: 0, winnerPayment: 0, refunds: 0 });
    const byAuction = new Map(
      sums.map((x) => [x.auction_id, {
        entryFees: num(x.entry_fees), bidFees: num(x.bid_fees), extraBids: num(x.extra_bids),
        winnerPayment: num(x.winner_payment), refunds: num(x.refunds),
      }]),
    );

    const itemsBy = new Map();
    for (const i of costItems || []) {
      const g = itemsBy.get(i.auction_id) || { entry: 0, bid: 0, other: 0, total: 0, list: [] };
      const kind = ["entry", "bid", "other"].includes(i.kind) ? i.kind : "other";
      g[kind] += abs(i.amount); g.total += abs(i.amount); g.list.push(i);
      itemsBy.set(i.auction_id, g);
    }
    const ovBy = new Map((overrides || []).map((o) => [o.auction_id, o]));

    return (auctions || [])
      .map((a) => {
        const m = byAuction.get(a.id) || blank();
        const ov = ovBy.get(a.id) || null;
        const items = itemsBy.get(a.id) || { entry: 0, bid: 0, other: 0, total: 0, list: [] };
        const incomeAdjust = num(ov?.income_adjust);
        const income = m.entryFees + m.bidFees + m.extraBids + m.winnerPayment + incomeAdjust;
        const hasWinner = !!(a.winner_id || a.winner_name);
        const baseProduct = ov && ov.cost_price !== null && ov.cost_price !== undefined ? num(ov.cost_price) : num(a.cost_price);
        const baseOther = ov && ov.other_cost !== null && ov.other_cost !== undefined ? num(ov.other_cost) : num(a.other_cost);
        const productCost = hasWinner ? baseProduct : 0;
        const otherCost = hasWinner ? baseOther : 0;
        const costs = productCost + otherCost + items.total + m.refunds;
        const net = income - costs;
        return {
          auction: a,
          ...m,
          override: ov,
          costItems: items.list,
          itemEntryCost: items.entry,
          itemBidCost: items.bid,
          itemOtherCost: items.other,
          itemCost: items.total,
          incomeAdjust,
          income,
          productCost,
          otherCost,
          costs,
          net,
          margin: income > 0 ? (net / income) * 100 : 0,
          roi: costs > 0 ? (net / costs) * 100 : null,
          seats: (a.subscriber_ids || []).length,
          hasWinner,
          pendingCost: !hasWinner && (baseProduct > 0 || baseOther > 0)
        };
      })
      .filter((r) => r.income > 0 || r.costs > 0 || r.auction.status !== "ended");
  }, [auctions, sums, costItems, overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter !== "all" && r.auction.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.auction.title || "").toLowerCase().includes(q) ||
        (r.auction.id || "").toLowerCase().includes(q) ||
        (r.auction.winner_name || "").toLowerCase().includes(q)
      );
    });
    const cmp = {
      net: (a, b) => b.net - a.net,
      income: (a, b) => b.income - a.income,
      margin: (a, b) => b.margin - a.margin,
      recent: (a, b) => new Date(b.auction.created_date || 0) - new Date(a.auction.created_date || 0)
    }[sortBy];
    return out.sort(cmp);
  }, [rows, search, statusFilter, sortBy]);

  const totals = useMemo(() => {
    const base = { entryFees: 0, bidFees: 0, extraBids: 0, winnerPayment: 0, refunds: 0, income: 0, costs: 0, net: 0, productCost: 0, otherCost: 0, itemCost: 0, seats: 0 };
    for (const r of filtered) {
      base.entryFees += r.entryFees; base.bidFees += r.bidFees; base.extraBids += r.extraBids;
      base.winnerPayment += r.winnerPayment; base.refunds += r.refunds; base.income += r.income;
      base.costs += r.costs; base.net += r.net; base.productCost += r.productCost;
      base.otherCost += r.otherCost; base.itemCost += r.itemCost; base.seats += r.seats;
    }
    base.margin = base.income > 0 ? (base.net / base.income) * 100 : 0;
    base.arpu = base.seats > 0 ? base.income / base.seats : 0;
    base.roi = base.costs > 0 ? (base.net / base.costs) * 100 : 0;
    return base;
  }, [filtered]);

  /** Daily revenue / cost trend across the selected window. */
  const trend = useMemo(() => {
    const r = RANGES.find((x) => x.id === range);
    const days = r?.days || 30;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const list = []; const byKey = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const item = { label: `${d.getDate()}/${d.getMonth() + 1}`, income: 0, refunds: 0 };
      list.push(item); byKey[dayKey(d)] = item;
    }
    // Server buckets are "YYYY-MM-DD" in the viewer's time zone, the same as dayKey().
    for (const d of daily) {
      const item = byKey[String(d.day).slice(0, 10)];
      if (!item) continue;
      item.income += num(d.income);
      item.refunds += num(d.refunds);
    }
    return list;
  }, [daily, range]);

  const mix = useMemo(() => ([
    { name: t.admin.revenue?.entryFees || "Entry fees", value: totals.entryFees, color: "hsl(var(--info))" },
    { name: t.admin.revenue?.bidFees || "Bid fees", value: totals.bidFees, color: "hsl(var(--info))" },
    { name: t.admin.revenue?.extraBids || "Extra bids", value: totals.extraBids, color: "hsl(var(--neon-violet))" },
    { name: t.admin.revenue?.winnerPayment || "Winner payment", value: totals.winnerPayment, color: "hsl(var(--success))" }
  ].filter((m) => m.value > 0)), [totals, t]);

  const topAuctions = useMemo(() => filtered.slice(0, 8).map((r) => ({
    name: (r.auction.title || "").slice(0, 18) || r.auction.id.slice(0, 6),
    income: r.income,
    net: r.net
  })), [filtered]);

  const exportCsv = () => {
    const head = [
      "auction_id", "title", "status", "mode", "seats", "winner", "entry_fees", "bid_fees",
      "extra_bids", "winner_payment", "income_adjust", "gross_income", "product_cost", "other_cost",
      "entry_cost_items", "bid_cost_items", "other_cost_items", "refunds",
      "total_cost", "net_profit", "margin_pct", "roi_pct", "created_date"
    ];
    const lines = filtered.map((r) => [
      r.auction.id, `"${(r.auction.title || "").replace(/"/g, '""')}"`, r.auction.status, r.auction.mode,
      r.seats, `"${(r.auction.winner_name || "").replace(/"/g, '""')}"`,
      r.entryFees.toFixed(2), r.bidFees.toFixed(2), r.extraBids.toFixed(2), r.winnerPayment.toFixed(2),
      r.incomeAdjust.toFixed(2), r.income.toFixed(2), r.productCost.toFixed(2), r.otherCost.toFixed(2),
      r.itemEntryCost.toFixed(2), r.itemBidCost.toFixed(2), r.itemOtherCost.toFixed(2), r.refunds.toFixed(2),
      r.costs.toFixed(2), r.net.toFixed(2), r.margin.toFixed(1), r.roi === null ? "" : r.roi.toFixed(1),
      r.auction.created_date || ""
    ].join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const L = t.admin.revenue || {};

  const Kpi = ({ icon: Icon, label, value, hint, tone = "default" }) => (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="w-4 h-4" />
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

  return (
    <div className="space-y-5">
      <div className="admin-page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{L.title || "Revenue"}</h2>
          <p className="text-sm text-muted-foreground">
            {L.subtitle || "Income, cost and profit for every auction."}
            {refreshedAt && <span className="ms-1 opacity-70">· {formatDateTime(refreshedAt)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  range === r.id ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"
                )}
              >
                {r.days ? `${r.days}d` : (L.allTime || "All")}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4 me-1.5", refreshing && "animate-spin")} />
            {t.common.refresh || "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 me-1.5" />CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={PhilippinePeso} label={L.grossIncome || "Gross income"} value={format(totals.income)} hint={`${code} · ${filtered.length} ${L.auctions || "auctions"}`} />
        <Kpi icon={Package} label={L.totalCost || "Total cost"} value={format(totals.costs)} tone="bad" hint={`${L.productCost || "Product"} ${format(totals.productCost)} · ${L.refunds || "Refunds"} ${format(totals.refunds)}`} />
        <Kpi icon={totals.net >= 0 ? TrendingUp : TrendingDown} label={L.netProfit || "Net profit"} value={format(totals.net)} tone={totals.net >= 0 ? "good" : "bad"} />
        <Kpi icon={Percent} label={L.margin || "Profit margin"} value={`${totals.margin.toFixed(1)}%`} hint={`ROI ${totals.roi.toFixed(1)}% · ${L.arpu || "Income per seat"} ${format(totals.arpu)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Ticket} label={L.entryFees || "Entry fees"} value={format(totals.entryFees)} />
        <Kpi icon={Gavel} label={L.bidFees || "Bid fees"} value={format(totals.bidFees)} />
        <Kpi icon={Coins} label={L.extraBids || "Extra bids sold"} value={format(totals.extraBids)} />
        <Kpi icon={Wallet} label={L.winnerPayment || "Winner payments"} value={format(totals.winnerPayment)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{L.trend || "Income vs refunds"}</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" interval="preserveStartEnd" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => format(v)}
                />
                <Area type="monotone" dataKey="income" name={L.grossIncome || "Gross income"} stroke="hsl(var(--info))" strokeWidth={2} fill="url(#rev-in)" dot={false} />
                <Area type="monotone" dataKey="refunds" name={L.refunds || "Refunds"} stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={0} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{L.mix || "Revenue mix"}</h3>
          <div className="h-[240px]">
            {mix.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                    {mix.map((m) => <Cell key={m.name} fill={m.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => format(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">{L.noData || "No revenue in this period"}</div>
            )}
          </div>
        </div>
      </div>

      {topAuctions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{L.topAuctions || "Top auctions: income vs net profit"}</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topAuctions} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v) => format(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name={L.grossIncome || "Gross income"} fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="net" name={L.netProfit || "Net profit"} fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 flex flex-wrap gap-2 items-center border-b border-border">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.searchPlaceholder || "Search auction, ID or winner"}
            className="max-w-xs h-9"
          />
          <SelectField
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">{L.allStatuses || "All statuses"}</option>
            <option value="open">{t.auction.statusOpen}</option>
            <option value="live">{t.auction.statusLive}</option>
            <option value="ended">{t.auction.statusEnded}</option>
          </SelectField>
          <SelectField
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="net">{L.sortNet || "Highest profit"}</option>
            <option value="income">{L.sortIncome || "Highest income"}</option>
            <option value="margin">{L.sortMargin || "Best margin"}</option>
            <option value="recent">{L.sortRecent || "Newest"}</option>
          </SelectField>
        </div>

        <div className="admin-table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-start">
                <th className="p-3 text-start font-medium">{L.auction || "Auction"}</th>
                <th className="p-3 text-end font-medium">{L.entryFees || "Entry fees"}</th>
                <th className="p-3 text-end font-medium">{L.bidFees || "Bid fees"}</th>
                <th className="p-3 text-end font-medium">{L.extraBids || "Extra bids"}</th>
                <th className="p-3 text-end font-medium">{L.winnerPayment || "Winner"}</th>
                <th className="p-3 text-end font-medium">{L.grossIncome || "Income"}</th>
                <th className="p-3 text-end font-medium">{L.totalCost || "Cost"}</th>
                <th className="p-3 text-end font-medium">{L.netProfit || "Net"}</th>
                <th className="p-3 text-end font-medium">{L.margin || "Margin"}</th>
                <th className="p-3 text-end font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t.common.loading || "Loading..."}</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{L.noData || "No revenue in this period"}</td></tr>
              )}
              {!loading && filtered.map((r) => {
                const open = expanded === r.auction.id;
                return (
                  <React.Fragment key={r.auction.id}>
                    <tr
                      className="border-t border-border hover:bg-muted/40 cursor-pointer"
                      onClick={() => setExpanded(open ? null : r.auction.id)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[220px]">{r.auction.title || r.auction.id.slice(0, 8)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {r.auction.status} · {r.seats} {L.seats || "seats"}
                              {r.auction.mode === "closest" ? ` · ${L.closest || "closest price"}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-end tabular-nums">{format(r.entryFees)}</td>
                      <td className="p-3 text-end tabular-nums">{format(r.bidFees)}</td>
                      <td className="p-3 text-end tabular-nums">{format(r.extraBids)}</td>
                      <td className="p-3 text-end tabular-nums">{format(r.winnerPayment)}</td>
                      <td className="p-3 text-end tabular-nums font-medium">{format(r.income)}</td>
                      <td className="p-3 text-end tabular-nums text-destructive">{format(r.costs)}</td>
                      <td className={cn("p-3 text-end tabular-nums font-semibold", r.net >= 0 ? "text-success" : "text-destructive")}>{format(r.net)}</td>
                      <td className="p-3 text-end tabular-nums">{r.income > 0 ? `${r.margin.toFixed(1)}%` : "—"}</td>
                      <td className="p-3 text-end tabular-nums">{r.roi === null ? "—" : `${r.roi.toFixed(1)}%`}</td>
                    </tr>
                    {open && (
                      <tr className="border-t border-border bg-muted/20">
                        <td colSpan={10} className="p-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">{L.income || "Income"}</p>
                              <Line label={L.entryFees || "Entry fees"} value={format(r.entryFees)} />
                              <Line label={L.bidFees || "Bid fees"} value={format(r.bidFees)} />
                              <Line label={L.extraBids || "Extra bids"} value={format(r.extraBids)} />
                              <Line label={L.winnerPayment || "Winner payment"} value={format(r.winnerPayment)} />
                              {r.incomeAdjust !== 0 && <Line label="Income adjustment" value={format(r.incomeAdjust)} />}
                              <Line label={L.grossIncome || "Gross income"} value={format(r.income)} strong />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">{L.costs || "Costs"}</p>
                              <Line label={L.productCost || "Product cost"} value={format(r.productCost)} />
                              <Line label={L.otherCost || "Other cost"} value={format(r.otherCost)} />
                              <Line label="Entry costs" value={format(r.itemEntryCost)} />
                              <Line label="Bid / processing costs" value={format(r.itemBidCost)} />
                              <Line label="Other expenses" value={format(r.itemOtherCost)} />
                              <Line label={L.refunds || "Refunds"} value={format(r.refunds)} />
                              <Line label={L.totalCost || "Total cost"} value={format(r.costs)} strong />
                              {r.pendingCost && (
                                <p className="text-[11px] text-warning">
                                  {L.costPending || "Cost is only counted once this auction has a winner."}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">{L.result || "Result"}</p>
                              <Line label={L.netProfit || "Net profit"} value={format(r.net)} strong />
                              <Line label={L.margin || "Margin"} value={r.income > 0 ? `${r.margin.toFixed(1)}%` : "—"} />
                              <Line label="ROI (net / cost)" value={r.roi === null ? "—" : `${r.roi.toFixed(1)}%`} />
                              <Line label={L.seats || "Seats"} value={String(r.seats)} />
                              <Line label={L.winner || "Winner"} value={r.auction.winner_name || "—"} />
                              <Line label={L.entryFee || "Entry fee"} value={format(num(r.auction.entry_fee))} />
                              <Line label={L.created || "Created"} value={formatDateTime(r.auction.created_date)} />
                            </div>
                          </div>
                          <div className="mt-4">
                            <AuctionFinancePanel
                              auction={r.auction}
                              row={r}
                              costItems={r.costItems}
                              override={r.override}
                              format={format}
                              onChanged={load}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-muted/50 font-semibold">
                <tr className="border-t border-border">
                  <td className="p-3">{L.totals || "Totals"}</td>
                  <td className="p-3 text-end tabular-nums">{format(totals.entryFees)}</td>
                  <td className="p-3 text-end tabular-nums">{format(totals.bidFees)}</td>
                  <td className="p-3 text-end tabular-nums">{format(totals.extraBids)}</td>
                  <td className="p-3 text-end tabular-nums">{format(totals.winnerPayment)}</td>
                  <td className="p-3 text-end tabular-nums">{format(totals.income)}</td>
                  <td className="p-3 text-end tabular-nums text-destructive">{format(totals.costs)}</td>
                  <td className={cn("p-3 text-end tabular-nums", totals.net >= 0 ? "text-success" : "text-destructive")}>{format(totals.net)}</td>
                  <td className="p-3 text-end tabular-nums">{totals.margin.toFixed(1)}%</td>
                  <td className="p-3 text-end tabular-nums">{totals.roi.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
