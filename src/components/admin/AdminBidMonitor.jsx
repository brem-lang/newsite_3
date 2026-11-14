import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivitySquare, AlertTriangle, CheckCircle2, Gauge, RefreshCw, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdminPagination, { paginate } from "@/components/admin/AdminPagination";

const FILTERS = ["all", "error", "warning", "info"];

/**
 * Bid observability: every bid/join/settlement attempt with its outcome,
 * latency and detected anomalies, so rare inconsistencies are debuggable.
 */
export default function AdminBidMonitor() {
  const { t } = useI18n();
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState({});
  const [auctions, setAuctions] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      base44.entities.BidEvent.list("-created_date", 300).catch(() => []),
      base44.entities.User.list("", 1000).catch(() => []),
      base44.entities.Auction.list("-created_date", 200).catch(() => []),
    ])
      .then(([ev, us, au]) => {
        setEvents(ev || []);
        const um = {}; (us || []).forEach((u) => { um[u.id] = u; }); setUsers(um);
        const am = {}; (au || []).forEach((a) => { am[a.id] = a; }); setAuctions(am);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const unsub = base44.entities.BidEvent.subscribe(({ data, event }) => {
      if (!data?.id || event === "DELETE") return;
      setEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, 300));
    });
    const poll = setInterval(() => { load(); }, 30000);
    return () => { unsub(); clearInterval(poll); };
  }, [live, load]);

  const stats = useMemo(() => {
    const since = Date.now() - 60 * 60 * 1000;
    const recent = events.filter((e) => new Date(e.created_date).getTime() >= since);
    const errors = recent.filter((e) => e.severity === "error");
    const accepted = recent.filter((e) => e.outcome === "accepted");
    const lat = recent.map((e) => Number(e.latency_ms || 0)).filter((n) => n > 0).sort((a, b) => a - b);
    const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : 0;
    return {
      total: recent.length,
      accepted: accepted.length,
      errors: errors.length,
      anomalies: recent.filter((e) => e.details?.anomaly).length,
      p95,
      rate: recent.length ? Math.round((errors.length / recent.length) * 100) : 0,
    };
  }, [events]);

  const rows = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.severity === filter)),
    [events, filter],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(1); }, [filter]);
  const visible = useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize]);

  const who = (id) => {
    const u = users[id];
    if (!id) return "—";
    return u ? u.full_name || u.email || `…${String(id).slice(-6)}` : `…${String(id).slice(-6)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr className="text-start">
                <Th>Time</Th><Th>Event</Th><Th>Auction</Th><Th>User</Th>
                <Th>Amount</Th><Th>Price</Th><Th>Outcome</Th><Th>Latency</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
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
                      "border-t border-border/60",
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
          <AdminPagination
            page={page} pageSize={pageSize} total={rows.length}
            onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>
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
