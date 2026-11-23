import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Radio, Users, Gavel, Trophy, Square, Flame, Maximize2, Coins, Hash } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminUserMap, adminLookups, warmAdmin } from "@/lib/queries/admin";
import { adminKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCountdownCompact, closeQuota } from "@/lib/auction";
import LiveAuctionMonitor, { useLiveAuctionStats } from "@/components/admin/LiveAuctionMonitor";

const NONE = [];

const liveListQuery = () => ({
  queryKey: adminKeys.section("live", "auctions"),
  queryFn: async () => (await base44.entities.Auction.filter({ status: "live" }, "-created_date", 50)) || [],
  staleTime: 10_000,
});

const liveDetailQuery = (id) => ({
  queryKey: adminKeys.section("live", "detail", id),
  queryFn: async () => {
    const [bids, credits, txns] = await Promise.all([
      base44.entities.Bid.filter({ auction_id: id }, "-created_date", 1000).catch(() => []),
      base44.entities.BidCredit.filter({ auction_id: id }, "-created_date", 500).catch(() => []),
      base44.entities.WalletTransaction.filter({ auction_id: id }, "-created_date", 1000).catch(() => []),
    ]);
    return { bids: bids || [], credits: credits || [], txns: txns || [] };
  },
  staleTime: 10_000,
});

/** Route loader: the live auctions, each one's stats, and the user lookup. */
export const prefetch = async (qc) => {
  const [auctions] = await warmAdmin(qc, liveListQuery(), adminLookups.users());
  await warmAdmin(qc, ...(auctions || []).slice(0, 100).map((a) => liveDetailQuery(a.id)));
};

export default function AdminLive() {
  const { t, format } = useI18n();
  const askConfirm = useConfirm();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(null);
  const [openId, setOpenId] = useState(null);
  const users = useAdminUserMap();

  const currency = t?.common?.currency || "$";

  // Live auctions: cached, 20s safety poll (paused in background tabs).
  // Realtime row changes are merged straight into the cache.
  const liveKey = adminKeys.section("live", "auctions");
  const { data: auctions = NONE, dataUpdatedAt, isPending: loading } = useQuery({
    ...liveListQuery(),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const loadAuctions = useCallback(() => qc.invalidateQueries({ queryKey: liveKey }), [qc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return base44.entities.Auction.subscribe(({ data, event }) => {
      if (!data?.id) return;
      qc.setQueryData(liveKey, (prev = []) => {
        if (event === "DELETE" || (data.status && data.status !== "live")) return prev.filter((x) => x.id !== data.id);
        const i = prev.findIndex((x) => x.id === data.id);
        if (i === -1) {
          // A newly live auction: re-read the list (it carries every column).
          qc.invalidateQueries({ queryKey: liveKey }, { cancelRefetch: false });
          return prev;
        }
        const next = [...prev];
        next[i] = { ...next[i], ...data };
        return next;
      });
    }, { onReconnect: loadAuctions });
  }, [qc, loadAuctions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-auction detail (bids, credits, wallet rows), one cached query each.
  const ids = auctions.map((x) => x.id).slice(0, 100);
  const idsKey = ids.join(",");
  const detailQueries = useQueries({
    queries: ids.map(liveDetailQuery),
  });
  const detail = {};
  ids.forEach((id, i) => { if (detailQueries[i]?.data) detail[id] = detailQueries[i].data; });
  const lastUpdate = Math.max(dataUpdatedAt || 0, ...detailQueries.map((q) => q.dataUpdatedAt || 0)) || Date.now();

  // Bids on the live auctions only (server-side filter). A busy auction gets
  // at most one detail re-read per 2s instead of three requests per bid.
  useEffect(() => {
    if (!idsKey) return;
    const timers = new Map();
    const refreshSoon = (id) => {
      if (timers.has(id)) return;
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        qc.invalidateQueries({ queryKey: adminKeys.section("live", "detail", id) }, { cancelRefetch: false });
      }, 2000));
    };
    const unsub = base44.entities.Bid.subscribe(
      ({ data }) => { if (data?.auction_id) refreshSoon(data.auction_id); },
      {
        filter: `auction_id=in.(${idsKey})`,
        onReconnect: () => qc.invalidateQueries({ queryKey: adminKeys.section("live", "detail") }),
      },
    );
    return () => { unsub(); timers.forEach(clearTimeout); };
  }, [idsKey, qc]);

  // Countdown clock only (no data fetching).
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const endNow = async (a) => {
    if (!(await askConfirm({ title: format(t.admin.confirm.closeTitle, { title: a.title }), description: t.admin.confirm.closeLiveDesc, confirmLabel: t.admin.confirm.closeLabel, destructive: true }))) return;
    setEnding(a.id);
    try {
      const result = await base44.functions.invoke("closeAuction", { auction_id: a.id });
      if (result?.data?.error) throw new Error(result.data.error);
      toast.success(t.admin.live.ended);
      loadAuctions();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setEnding(null);
    }
  };

  const openAuction = auctions.find((a) => a.id === openId) || null;
  const openDetail = detail[openId] || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radio className="w-6 h-6 text-destructive animate-pulse" />{t.admin.live.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
          {t.admin.live.subtitle}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success" aria-live="polite">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {Math.max(0, Math.round((now - lastUpdate) / 1000))}s
          </span>
        </p>
      </div>

      {loading ? null : auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.live.empty}</div>
      ) : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {auctions.map((a) => (
            <LiveCard
              key={a.id}
              auction={a}
              users={users}
              data={detail[a.id]}
              now={now}
              currency={currency}
              t={t}
              ending={ending === a.id}
              onOpen={() => setOpenId(a.id)}
              onEnd={() => endNow(a)}
            />
          ))}
        </div>
      )}

      <LiveAuctionMonitor
        auction={openAuction}
        users={users}
        bids={openDetail.bids || []}
        credits={openDetail.credits || []}
        txns={openDetail.txns || []}
        loading={!!openId && !detail[openId]}
        currency={currency}
        open={!!openId}
        onOpenChange={(v) => !v && setOpenId(null)}
      />
    </div>
  );
}

function LiveCard({ auction: a, users, data, now, currency, t, ending, onOpen, onEnd }) {
  const s = useLiveAuctionStats(a, data?.bids || [], data?.credits || [], data?.txns || []);
  const remaining = a.end_time ? Math.max(0, new Date(a.end_time).getTime() - now) : 0;
  const target = closeQuota(a);
  const pct = useMemo(() => Math.min(100, target ? (s.seated / target) * 100 : 0), [s.seated, target]);
  const leader = s.isSealed ? s.closest && users[s.closest.user_id] : users[a.highest_bidder_id];

  return (
    <div className="native-panel rounded-2xl overflow-hidden flex flex-col">
      <button type="button" onClick={onOpen} className="p-4 text-start border-b border-border hover:bg-secondary/40 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              {s.isSealed ? "Closest price" : "Ascending"} · Round {s.round}
            </span>
            <h3 className="font-heading text-base font-semibold mt-1 truncate">{a.title}</h3>
          </div>
          <div className="text-end shrink-0">
            <p className={cn("font-mono text-lg font-bold tabular-nums", remaining < 30000 ? "text-destructive" : "text-foreground")}>
              {formatCountdownCompact(remaining, t)}
            </p>
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Maximize2 className="w-3 h-3" />Open monitor
            </span>
          </div>
        </div>
      </button>

      <div className="p-4 space-y-3 flex-1">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
              <Users className="w-3.5 h-3.5" />{t.admin.live.seats}
            </span>
            <span dir="ltr" className="font-semibold tabular-nums">
              {s.seated} / {target}
              <span className="text-muted-foreground font-normal"> min</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", s.seated >= target ? "bg-success" : "bg-info")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className={cn("grid gap-2 text-center", s.pool ? "grid-cols-4" : "grid-cols-3")}>
          <Mini icon={Gavel} label="Bids" value={s.live.length} />
          <Mini icon={Flame} label="Burned" value={s.burnedNumbers.length} tone={s.burnedNumbers.length ? "orange" : undefined} />
          {s.pool && <Mini icon={Hash} label="Free" value={s.pool.free.toLocaleString("en-GB")} />}
          <Mini icon={Coins} label="Fees" value={`${currency}${(s.totals.feeTotal + s.totals.creditsSpendTotal).toFixed(0)}`} />
        </div>

        {s.pool && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>Number pool</span>
              <span>{s.pool.free.toLocaleString("en-GB")} free / {s.pool.total.toLocaleString("en-GB")}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", s.pool.freePct <= 10 ? "bg-destructive" : s.pool.freePct <= 30 ? "bg-warning" : "bg-success")}
                style={{ width: `${Math.max(s.pool.freePct, 2)}%` }}
              />
            </div>
          </div>
        )}


        <div className="rounded-xl bg-secondary/50 px-3 py-2 flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <Trophy className="w-3.5 h-3.5" />{s.isSealed ? "Closest" : t.admin.live.leader}
          </span>
          <span className="font-semibold truncate">
            {leader ? (leader.full_name || leader.email?.split("@")[0]) : t.auction.noBids}
            {s.isSealed && s.closest && <span className="text-muted-foreground font-normal tabular-nums"> · {currency}{Number(s.closest.amount).toFixed(2)}</span>}
            {!s.isSealed && <span className="text-muted-foreground font-normal tabular-nums"> · {currency}{Number(a.current_price || 0).toFixed(2)}</span>}
          </span>
        </div>

        {s.burnedNumbers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.burnedNumbers.slice(0, 8).map((n) => (
              <span key={n} className="rounded-lg bg-warning/10 border border-warning/25 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-warning line-through">
                {currency}{n.toFixed(2)}
              </span>
            ))}
            {s.burnedNumbers.length > 8 && (
              <span className="text-[11px] text-muted-foreground self-center">+{s.burnedNumbers.length - 8}</span>
            )}
          </div>
        )}

        {s.silent.length > 0 && (
          <p className="text-[11px] text-warning">{s.silent.length} joined without bidding</p>
        )}
      </div>

      <div className="p-4 pt-0 grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-2" onClick={onOpen}>
          <Maximize2 className="w-4 h-4" />Details
        </Button>
        <Button variant="destructive" className="gap-2" onClick={onEnd} disabled={ending}>
          <Square className="w-4 h-4" />{ending ? t.auction.joining : t.admin.live.endNow}
        </Button>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, tone }) {
  return (
    <div className={cn("rounded-xl border border-border p-2", tone === "orange" && "border-warning/25 bg-warning/10")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
        <Icon className="w-3 h-3" />{label}
      </p>
      <p dir="ltr" className={cn("font-bold tabular-nums text-sm mt-0.5", tone === "orange" && "text-warning")}>{value}</p>
    </div>
  );
}
