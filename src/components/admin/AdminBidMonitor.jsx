import React, { useCallback, useEffect, useState } from "react";
import { ActivitySquare, AlertTriangle, CheckCircle2, Gauge, RefreshCw, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminPage, useAdminUsersByIds, useAdminAuctionsByIds, adminPageQuery, adminSection, adminRpc, firstPage, warmAdmin } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { useInvalidateOn } from "@/lib/queries/live";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdminPagination from "@/components/admin/AdminPagination";

const FILTERS = ["all", "error", "warning", "info"];

/**
 * Bid observability: every bid/join/settlement attempt with its outcome,
 * latency and detected anomalies, so rare inconsistencies are debuggable.
 */
const NO_STATS = { total: 0, accepted: 0, errors: 0, anomalies: 0, p95: 0, rate: 0 };
const filtersFor = (filter) => ({ sort: "-created_date", where: filter === "all" ? {} : { severity: filter } });

/** Last-hour health numbers, counted in Postgres (admin_bid_monitor_stats). */
const statsQuery = (live) =>
  adminSection(
    adminKeys.bidMonitorStats(),
    async () => ({ ...NO_STATS, ...((await adminRpc("admin_bid_monitor_stats", { _since: new Date(Date.now() - 3_600_000).toISOString() })) || {}) }),
    { refetchInterval: live ? 30_000 : false, refetchIntervalInBackground: false },
  );

/** Route loader: the health numbers and the first page of events. */
export const prefetch = (qc) => {
  const params = firstPage(filtersFor("all"));
  return warmAdmin(qc, statsQuery(true), adminPageQuery("BidEvent", adminKeys.bidMonitorPage(params), params));
};

export default function AdminBidMonitor() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [live, setLive] = useState(true);

  // One server page of the event log; in live mode a 30s safety poll (paused
  // in background tabs) backs up the realtime stream below.
  const table = useAdminPage("BidEvent", adminKeys.bidMonitorPage, filtersFor(filter), {
    refetchInterval: live ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const { rows: visible, isFetching: loading, page, queryKey } = table;
  const { data: stats = NO_STATS } = useQuery(statsQuery(live));
  const load = useCallback(() => qc.invalidateQueries({ queryKey: adminKeys.bidMonitorAll() }), [qc]);

  // Labels for just the rows on this page.
  const users = useAdminUsersByIds(visible.map((e) => e.user_id));
  const auctions = useAdminAuctionsByIds(visible.map((e) => e.auction_id));

  // New events go straight onto page 1 (when they match the filter); other
  // pages and the stats refresh on the throttled invalidation below.
  useEffect(() => {
    if (!live || page !== 1) return;
    return base44.entities.BidEvent.subscribe(({ data, event }) => {
      if (!data?.id || event === "DELETE") return;
      if (filter !== "all" && data.severity !== filter) return;
      qc.setQueryData(queryKey, (prev) => {
        if (!prev) return prev;
        const known = prev.rows.some((e) => e.id === data.id);
        const rows = [data, ...prev.rows.filter((e) => e.id !== data.id)].slice(0, prev.pageSize);
        const total = known ? prev.total : prev.total + 1;
        return { ...prev, rows, total, pageCount: Math.max(1, Math.ceil(total / prev.pageSize)) };
      });
    }, { onReconnect: () => qc.invalidateQueries({ queryKey }) });
  }, [live, page, filter, qc, JSON.stringify(queryKey)]); // eslint-disable-line react-hooks/exhaustive-deps
  useInvalidateOn(base44.entities.BidEvent, adminKeys.bidMonitorStats(), { throttleMs: 5000, enabled: live });

  const who = (id) => {
    const u = users[id];
    if (!id) return "—";
    return u ? u.full_name || u.email || `…${String(id).slice(-6)}` : `…${String(id).slice(-6)}`;
  };

  return (
    // admin-fill / admin-table-card: the table fills the visible height (src/styles.css).
    <div className="space-y-6 admin-fill">
      <div className="admin-page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <ActivitySquare className="w-6 h-6 text-info" />
            {t.admin.tabs.bidmonitor}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every bid, join and settlement attempt with outcome, latency and anomaly detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setLive((v) => !v)}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full bg-current", live && "animate-pulse")} />
            {live ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={ActivitySquare} label="Events (1h)" value={stats.total} />
        <Stat icon={CheckCircle2} label="Accepted" value={stats.accepted} tone="emerald" />
        <Stat
          icon={AlertTriangle}
          label="Errors"
          value={`${stats.errors} (${stats.rate}%)`}
          tone={stats.errors ? "rose" : "muted"}
        />
        <Stat
          icon={ShieldAlert}
          label="Anomalies"
          value={stats.anomalies}
          tone={stats.anomalies ? "rose" : "muted"}
        />
        <Stat icon={Gauge} label="p95 latency" value={`${stats.p95} ms`} />
      </div>

      {stats.anomalies > 0 && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {stats.anomalies} bid event(s) in the last hour reported a price regression or unpaid settlement.
            Inspect the flagged rows below.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize",
              filter === f
                ? "bg-info text-info-foreground border-info/40"
                : "bg-card text-muted-foreground border-border hover:bg-secondary",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="admin-table-card rounded-2xl border border-border bg-card overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr className="text-start">
                <Th>Time</Th><Th>Event</Th><Th>Auction</Th><Th>User</Th>
                <Th>Amount</Th><Th>Price</Th><Th>Outcome</Th><Th>Latency</Th>
              </tr>
            </thead>
            <tbody>
              {table.total === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No bid events recorded yet."}
                  </td>
                </tr>
              ) : (
                visible.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-b border-border/60",
                      e.severity === "error" && "bg-destructive/10",
                      e.details?.anomaly && "bg-destructive/15",
                    )}
                  >
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {new Date(e.created_date).toLocaleString("en-GB")}
                    </Td>
                    <Td className="font-semibold capitalize">{e.event}</Td>
                    <Td className="max-w-[200px] truncate">
                      {auctions[e.auction_id]?.title || (e.auction_id ? `…${String(e.auction_id).slice(-6)}` : "—")}
                    </Td>
                    <Td className="max-w-[160px] truncate">{who(e.user_id)}</Td>
                    <Td className="font-mono">{e.amount != null ? Number(e.amount).toFixed(2) : "—"}</Td>
                    <Td className="font-mono text-muted-foreground">
                      {Number(e.price_before || 0).toFixed(2)} → {Number(e.price_after || 0).toFixed(2)}
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
                          e.severity === "error"
                            ? "bg-destructive text-destructive-foreground"
                            : e.severity === "warning"
                              ? "bg-warning/15 text-warning"
                              : "bg-success/15 text-success",
                        )}
                      >
                        {e.reason || e.outcome}
                      </span>
                      {e.details?.anomaly && (
                        <span className="ms-2 text-[11px] font-bold text-destructive">{e.details.anomaly}</span>
                      )}
                      {e.details?.burned && (
                        <span className="ms-2 text-[11px] font-bold text-warning">burned</span>
                      )}
                    </Td>
                    <Td className="font-mono text-muted-foreground">
                      {e.latency_ms != null ? `${e.latency_ms} ms` : "—"}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination {...table.pagination} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "blue" }) {
  const tones = {
    blue: "text-info",
    emerald: "text-success",
    rose: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("w-3.5 h-3.5", tones[tone])} />
        {label}
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

const Th = ({ children }) => <th className="px-4 py-2.5 text-start font-semibold">{children}</th>;
const Td = ({ children, className }) => <td className={cn("px-4 py-2.5", className)}>{children}</td>;
