import React, { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  BarChart3, PhilippinePeso, Percent, TrendingDown, Wallet, Gavel, Users as UsersIcon,
  Radio, Trophy, ShieldCheck, LifeBuoy, RefreshCw, ArrowRight, Plus, RadioTower
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { keepPreviousData } from "@tanstack/react-query";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import AdminRevenueStream, { prefetch as prefetchRevenueStream } from "@/components/admin/AdminRevenueStream";


const RANGES = [7, 30, 90, 365];
const DEFAULT_DAYS = 30;

const loadDashboard = async (days) => (await base44.functions.invoke("adminDashboard", { days })).data || null;

/** Route loader: the default range's dashboard and the revenue stream below it. */
export const prefetch = (qc) =>
  Promise.all([
    warmAdmin(qc, adminSection(adminKeys.analytics(DEFAULT_DAYS), () => loadDashboard(DEFAULT_DAYS))),
    prefetchRevenueStream(qc),
  ]);

export default function AdminAnalytics() {
  const { lang } = useI18n();
  const { format } = useCurrency();
  const navigate = useNavigate();

  const [days, setDays] = useState(DEFAULT_DAYS);
  // One cached dashboard per range; switching ranges keeps the previous
  // numbers on screen until the new ones arrive.
  const { data = null, isPending: loading, isFetching: refreshing, refresh } = useAdminData(
    adminKeys.analytics(days),
    () => loadDashboard(days),
    { placeholderData: keepPreviousData },
  );
  const load = () => refresh();

  const series = useMemo(() => (data?.series || []).map((s) => {
    const d = new Date(s.day);
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      income: Number(s.income || 0),
      refunds: Number(s.refunds || 0),
      deposits: Number(s.deposits || 0),
      bids: Number(s.bids || 0),
      users: Number(s.users || 0),
    };
  }), [data]);

  const mix = useMemo(() => ([
    { label: "Entry fees", value: Number(data?.entry_fees || 0) },
    { label: "Bid fees", value: Number(data?.bid_fees || 0) },
    { label: "Extra bids", value: Number(data?.extra_bids || 0) },
    { label: "Winner payments", value: Number(data?.winner_payment || 0) },
  ]), [data, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const net = Number(data?.net || 0);

  const kpis = [
    { icon: PhilippinePeso, label: "Gross income", value: format(Number(data?.income || 0)), hint: "Entry + bid fees, extra bids, winner payments" },
    { icon: TrendingDown, label: "Total cost", value: format(Number(data?.costs || 0)), hint: "Products, extras and refunds" },
    { icon: BarChart3, label: "Net profit", value: format(net), tone: net >= 0 ? "good" : "bad" },
    { icon: Percent, label: "Gross margin", value: `${Number(data?.margin || 0).toFixed(1)}%`, hint: `Income per seat ${format(Number(data?.arpu || 0))}` },
  ];

  const ops = [
    { icon: Radio, label: "Live auctions", value: data?.live_auctions || 0, to: "/admin/live" },
    { icon: Gavel, label: "Open auctions", value: data?.open_auctions || 0, to: "/admin/auctions" },
    { icon: Trophy, label: "Unpaid wins", value: data?.unpaid_wins || 0, sub: format(Number(data?.unpaid_amount || 0)), to: "/admin/winnerpayments", alert: (data?.unpaid_wins || 0) > 0 },
    { icon: ShieldCheck, label: "Pending verifications", value: data?.pending_verifications || 0, to: "/admin/verification", alert: (data?.pending_verifications || 0) > 0 },
    { icon: Wallet, label: "Deposits to approve", value: data?.pending_topups || 0, to: "/admin/payments", alert: (data?.pending_topups || 0) > 0 },
    { icon: LifeBuoy, label: "Open tickets", value: data?.open_tickets || 0, to: "/admin/support", alert: (data?.open_tickets || 0) > 0 },
    { icon: RefreshCw, label: "Refund requests", value: data?.pending_refunds || 0, to: "/admin/refunds", alert: (data?.pending_refunds || 0) > 0 },
    { icon: UsersIcon, label: "New participants", value: data?.new_users || 0, sub: `${data?.bids || 0} bids`, to: "/admin/participants" },
  ];

  const tip = {
    contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 },
    labelStyle: { color: "hsl(var(--foreground))" },
  };

  return (
    <div className="space-y-6">
      {/* admin-page-header: sticky title with the header backdrop (src/styles.css). */}
      <div className="admin-page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            {"Business overview"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {"Revenue, profit and what needs your attention."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="gold-button" onClick={() => navigate({ to: "/admin/$section", params: { section: "auctions" } })}>
            <Plus className="w-4 h-4" />{"New auction"}
          </Button>
          <Button variant="outline" className="border-accent/35 text-accent" onClick={() => navigate({ to: "/admin/$section", params: { section: "live" } })}>
            <RadioTower className="w-4 h-4" />{"Manage live"}
          </Button>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  days === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                )}
              >
                {d === 365 ? "1 year" : `${d}d`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => load(days)} disabled={refreshing} aria-label={"Refresh"}>
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="native-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <k.icon className="w-4 h-4" /><span className="truncate">{k.label}</span>
            </div>
            <p className={cn(
              "mt-2 text-xl font-semibold tabular-nums",
              k.tone === "good" && "text-success",
              k.tone === "bad" && "text-destructive"
            )}>{k.value}</p>
            {k.hint && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{k.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ops.map((o) => (
          <button
            key={o.label}
            onClick={() => navigate({ to: "/admin/$section", params: { section: o.to.replace("/admin/", "") } })}
            className={cn(
              "native-panel text-start rounded-2xl p-4 transition-all hover:border-accent/45 hover:-translate-y-0.5",
              o.alert && "border-warning/50"
            )}
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs font-medium">
              <span className="flex items-center gap-2 truncate"><o.icon className="w-4 h-4" />{o.label}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", o.alert && "text-warning")}>{o.value}</p>
            {o.sub && <p className="text-[11px] text-muted-foreground">{o.sub}</p>}
          </button>
        ))}
      </div>

      <AdminRevenueStream />

      <div className="grid lg:grid-cols-2 gap-5">

        <div className="native-panel rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{"Income vs refunds"}</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="aInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient>
                  <linearGradient id="aRef" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" interval={Math.max(0, Math.floor(series.length / 6))} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v) => format(Number(v))} />
                <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#aInc)" dot={false} />
                <Area type="monotone" dataKey="refunds" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#aRef)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="native-panel rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{"Revenue mix"}</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mix} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v) => format(Number(v))} />
                <Bar dataKey="value" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="native-panel rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{"Wallet deposits"}</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="aDep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.28} /><stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" interval={Math.max(0, Math.floor(series.length / 6))} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v) => format(Number(v))} />
                <Area type="monotone" dataKey="deposits" stroke="hsl(var(--info))" strokeWidth={2} fill="url(#aDep)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="native-panel rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{"Bids and new participants"}</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" interval={Math.max(0, Math.floor(series.length / 6))} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} />
                <Bar dataKey="bids" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="users" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
