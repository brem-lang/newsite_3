import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Hash, AlertTriangle, Timer, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const nf = (n) => Number(n || 0).toLocaleString("en-GB");

/**
 * Reads the number pool from the single server endpoint so every surface shows
 * identical totals. Re-fetches whenever a realtime bid event bumps `revision`.
 */
export function useNumberPool(auctionId, { enabled = true, revision = 0 } = {}) {
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!auctionId) return null;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("auctionNumberPool", { auction_id: auctionId });
      const data = res?.data || res;
      if (alive.current && data && !data.error) setPool(data);
      return data;
    } catch {
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    if (!enabled || !auctionId) return;
    refresh();
  }, [enabled, auctionId, revision, refresh]);

  return { pool, loading, refresh };
}

function etaText(ms) {
  if (ms == null) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Free-number sparkline: one point per bid, oldest to newest. */
function PoolChart({ history = [], total = 0, warnPct = 20 }) {
  const points = useMemo(() => {
    const base = [{ free: total }, ...history];
    const n = base.length;
    if (n < 2 || !(total > 0)) return null;
    const w = 100;
    const h = 34;
    return base
      .map((p, i) => {
        const x = (i / (n - 1)) * w;
        const y = h - (Math.max(0, Math.min(total, p.free)) / total) * h;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [history, total]);

  const warnY = 34 - (warnPct / 100) * 34;

  return (
    <div className="relative">
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="w-full h-20" role="img" aria-label="Free numbers over the round">
        <line x1="0" x2="100" y1={warnY} y2={warnY} stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" className="text-warning" />
        {points ? (
          <>
            <polyline points={`0,34 ${points} 100,34`} fill="currentColor" className="text-info/10" stroke="none" />
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-info" />
          </>
        ) : (
          <line x1="0" x2="100" y1="0.5" y2="0.5" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-info" />
        )}
      </svg>
      <p className="text-[10px] text-muted-foreground mt-1">
        Free numbers over the round · dashed line = {warnPct}% warning threshold
      </p>
    </div>
  );
}

/**
 * Live number-pool panel: server-sourced counters, a real-time free-number
 * chart, and a flashing warning with the estimated time to end once the pool
 * drops under the auction's configured threshold.
 */
export default function NumberPoolPanel({ pool }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!pool || !pool.sealed || !(pool.total_numbers > 0)) return null;

  const freePct = Number(pool.free_pct || 0);
  const warnPct = Number(pool.warn_pct ?? 20);
  const warning = !!pool.warning;
  const endMs = pool.end_time ? new Date(pool.end_time).getTime() : null;
  const projectedMs = pool.projected_end_time ? new Date(pool.projected_end_time).getTime() : null;
  const earliestMs = pool.earliest_end_time ? new Date(pool.earliest_end_time).getTime() : null;

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", warning ? "border-destructive/40 bg-destructive/10" : "border-border bg-card")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5" />Number pool (live)
          {warning && (
            <span
              className="ms-1 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground animate-pulse"
              aria-live="assertive"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-ping" />Low
            </span>
          )}
        </p>
        <p className="text-xs font-semibold tabular-nums">
          <span className={cn(freePct <= 10 ? "text-destructive" : freePct <= warnPct ? "text-warning" : "text-success")}>
            {nf(pool.free_numbers)} free
          </span>
          <span className="text-muted-foreground"> / {nf(pool.total_numbers)}</span>
        </p>
      </div>

      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            freePct <= 10 ? "bg-destructive" : freePct <= warnPct ? "bg-warning" : "bg-success",
            warning && "animate-pulse",
          )}
          style={{ width: `${Math.max(freePct, 2)}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Total", nf(pool.total_numbers)],
          ["Taken", nf(pool.used_numbers)],
          ["Burned", nf(pool.burned_numbers)],
          ["Free", nf(pool.free_numbers)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-secondary/60 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <PoolChart history={pool.history} total={pool.total_numbers} warnPct={warnPct} />

      {warning && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2" role="status">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              Only {nf(pool.free_numbers)} free numbers left ({freePct}% — threshold {warnPct}%).
            </p>
            <p className="text-xs">
              The round closes automatically at {nf(pool.floor_numbers)} free numbers. Estimated end in{" "}
              <b className="tabular-nums">{etaText(projectedMs != null ? projectedMs - now : endMs != null ? endMs - now : null)}</b>
              {endMs != null && <> · deadline in <span className="tabular-nums">{etaText(endMs - now)}</span></>}.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <Timer className="w-3 h-3" />Ends in <span className="tabular-nums">{etaText(endMs != null ? endMs - now : null)}</span>
        </span>
        {Number(pool.min_round_minutes) > 0 && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />Minimum round {pool.min_round_minutes}m
            {earliestMs != null && <> · earliest end in <span className="tabular-nums">{etaText(Math.max(earliestMs - now, 0))}</span></>}
          </span>
        )}
      </p>
    </div>
  );
}
