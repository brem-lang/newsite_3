import React, { useMemo, useState } from "react";
import { Flame, Users, Gavel, Archive, Trophy, Target, Coins, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { closeQuota } from "@/lib/auction";
import NumberPoolPanel, { useNumberPool } from "@/components/admin/NumberPoolPanel";

const money = (n) => Number(n || 0).toFixed(2);
const time = (d) => (d ? new Date(d).toLocaleString("en-GB") : "");

export function useLiveAuctionStats(auction, bids = [], credits = [], txns = []) {
  return useMemo(() => {
    const round = Number(auction?.round || 1);
    const isSealed = auction?.mode === "closest";
    const live = bids.filter((b) => !b.archived && Number(b.round || 1) === round);
    const archived = bids.filter((b) => b.archived || Number(b.round || 1) !== round);

    const creditsByUser = {};
    credits.filter((c) => Number(c.round || 1) === round).forEach((c) => {
      creditsByUser[c.user_id] = (creditsByUser[c.user_id] || 0) + Number(c.credits || 0);
    });

    const feesByUser = {};
    const spendByUser = {};
    let feeTotal = 0;
    let creditsSpendTotal = 0;
    let entryTotal = 0;
    txns.forEach((tx) => {
      const amt = Math.abs(Number(tx.amount || 0));
      if (tx.type === "bid_fee") { feesByUser[tx.user_id] = (feesByUser[tx.user_id] || 0) + amt; feeTotal += amt; }
      if (tx.type === "bid_credits") { spendByUser[tx.user_id] = (spendByUser[tx.user_id] || 0) + amt; creditsSpendTotal += amt; }
      if (tx.type === "subscription") entryTotal += amt;
    });

    const baseQuota = Math.max(1, Number(auction?.bids_per_participant || 5));
    const seated = auction?.subscriber_ids || [];

    const participants = seated.map((uid) => {
      const mine = live.filter((b) => b.user_id === uid);
      const extra = creditsByUser[uid] || 0;
      return {
        user_id: uid,
        bids: mine.sort((a, b) => Number(a.amount) - Number(b.amount)),
        used: mine.length,
        burned: mine.filter((b) => b.burned).length,
        extra,
        quota: isSealed ? baseQuota + extra : null,
        fees: feesByUser[uid] || 0,
        creditsSpend: spendByUser[uid] || 0,
        best: mine.length ? Math.max(...mine.map((b) => Number(b.amount || 0))) : null,
      };
    }).sort((a, b) => b.used - a.used);

    const burnedNumbers = [...new Set(live.filter((b) => b.burned).map((b) => Number(b.amount)))].sort((a, b) => a - b);

    // Number pool (integer cents): exactly 100 numbers per whole currency unit.
    let pool = null;
    if (isSealed) {
      const totalNumbers = Math.max(Math.round(Number(auction?.target_price || 0) * 100), 1);
      const usedNumbers = new Set(live.map((b) => Number(b.amount))).size;
      const freeNumbers = Math.max(totalNumbers - usedNumbers, 0);
      pool = {
        total: totalNumbers,
        used: usedNumbers,
        free: freeNumbers,
        freePct: Math.round((freeNumbers / totalNumbers) * 100),
      };
    }



    // Closest-under-target leader for sealed auctions.
    let closest = null;
    if (isSealed) {
      const target = Number(auction?.target_price || 0);
      const valid = live.filter((b) => !b.burned && (!target || Number(b.amount) <= target));
      if (valid.length) {
        closest = valid.reduce((best, b) => (Number(b.amount) > Number(best.amount) ? b : best), valid[0]);
      }
    }

    const target = closeQuota(auction);

    return {
      round, isSealed, live, archived, participants, burnedNumbers, closest, pool,
      seatTarget: target,

      seated: seated.length,
      silent: participants.filter((p) => p.used === 0),
      totals: { feeTotal, creditsSpendTotal, entryTotal, creditsSold: Object.values(creditsByUser).reduce((s, n) => s + n, 0) },
    };
  }, [auction, bids, credits, txns]);
}

function Name({ users, id }) {
  const u = users?.[id];
  return <span className="truncate">{u ? (u.full_name || u.email?.split("@")[0]) : `…${String(id || "").slice(-6)}`}</span>;
}

function NumberChip({ bid, currency }) {
  return (
    <span
      title={time(bid.created_date)}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums",
        bid.burned
          ? "bg-warning/15 text-warning line-through"
          : "bg-info/10 text-info border border-info/15",
      )}
    >
      {bid.burned && <Flame className="w-3 h-3" />}
      {currency}{money(bid.amount)}
    </span>
  );
}

export default function LiveAuctionMonitor({ auction, users = {}, bids = [], credits = [], txns = [], open, onOpenChange, currency = "$" }) {
  const s = useLiveAuctionStats(auction, bids, credits, txns);
  const [tab, setTab] = useState("participants");
  // Realtime bid events change the bid list, which re-reads the shared endpoint.
  const { pool: serverPool } = useNumberPool(auction?.id, {
    enabled: !!open && auction?.mode === "closest",
    revision: bids.length + s.burnedNumbers.length,
  });
  // Optimistic local mirror until the first server response lands.
  const fallbackPool = useMemo(() => {
    if (!s.pool) return null;
    return {
      sealed: true,
      total_numbers: s.pool.total,
      used_numbers: s.pool.used,
      burned_numbers: s.burnedNumbers.length,
      free_numbers: s.pool.free,
      free_pct: s.pool.freePct,
      warn_pct: Number(auction?.pool_warn_pct ?? 20),
      warning: s.pool.freePct <= Number(auction?.pool_warn_pct ?? 20),
      floor_numbers: Math.max(Math.ceil(s.pool.total * 0.05), 3),
      min_round_minutes: Number(auction?.min_round_minutes ?? 0),
      end_time: auction?.end_time || null,
      earliest_end_time: null,
      projected_end_time: null,
      history: [],
    };
  }, [s.pool, s.burnedNumbers.length, auction]);
  if (!auction) return null;

  const archivedGroups = (() => {
    const m = new Map();
    s.archived.forEach((b) => {
      const r = Number(b.round || 1);
      if (!m.has(r)) m.set(r, []);
      m.get(r).push(b);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="shrink-0 p-5 pb-4 pe-12 border-b border-border text-start">
          <SheetTitle className="font-heading text-xl truncate">{auction.title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />Live · Round {s.round}
            </span>
            <span>·</span>
            <span>{s.isSealed ? "Closest price" : "Ascending"}</span>
            <span>·</span>
            <span dir="ltr">{s.seated}/{s.seatTarget} participants (minimum)</span>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={Users} label="Participants" value={`${s.seated} / ${s.seatTarget}`} hint={s.seated >= s.seatTarget ? "Minimum reached" : `${s.seatTarget - s.seated} more to close`} />
            <Stat icon={Gavel} label="Bids this round" value={s.live.length} hint={`${s.burnedNumbers.length} burned`} />
            <Stat icon={Coins} label="Fees collected" value={`${currency}${money(s.totals.feeTotal + s.totals.creditsSpendTotal)}`} hint={`${s.totals.creditsSold} extra bids sold`} />
            {s.isSealed ? (
              <Stat icon={Target} label="Selling price (hidden)" value={`${currency}${money(auction.target_price)}`} hint={s.closest ? "Closest is below" : "No valid number yet"} />
            ) : (
              <Stat icon={Trophy} label="Current bid" value={`${currency}${money(auction.current_price)}`} hint={users[auction.highest_bidder_id]?.full_name || "No bids yet"} />
            )}
          </div>

          {s.isSealed && (
            <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Currently closest</p>
                {s.closest ? (
                  <p className="font-semibold mt-0.5 flex items-center gap-2 min-w-0">
                    <Name users={users} id={s.closest.user_id} />
                    <span className="tabular-nums">{currency}{money(s.closest.amount)}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">No valid number under the selling price yet</p>
                )}
              </div>
              <Trophy className="w-5 h-5 text-warning shrink-0" />
            </div>
          )}

          {/* Server-sourced pool: total / burned / free, chart + low-pool alert. */}
          <NumberPoolPanel pool={serverPool || fallbackPool} />



          {s.burnedNumbers.length > 0 && (
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-warning flex items-center gap-1.5 mb-2">
                <Flame className="w-3.5 h-3.5" />Burned numbers ({s.burnedNumbers.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.burnedNumbers.map((n) => (
                  <span key={n} className="rounded-lg bg-card px-2 py-0.5 text-xs font-bold tabular-nums text-warning line-through border border-warning/25">
                    {currency}{money(n)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {s.silent.length > 0 && (
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-sm text-warning flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{s.silent.length} participant{s.silent.length > 1 ? "s" : ""} joined but haven't bid yet.</span>
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="participants" className="flex-1">Participants ({s.participants.length})</TabsTrigger>
              <TabsTrigger value="bids" className="flex-1">All bids ({s.live.length})</TabsTrigger>
              <TabsTrigger value="archive" className="flex-1">Archive ({s.archived.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="participants" className="mt-4">
              {s.participants.length === 0 ? (
                <Empty text="No participants yet" />
              ) : (
                <div className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
                  {s.participants.map((p) => (
                    <div key={p.user_id} className={cn("p-3 space-y-2", p.used === 0 && "bg-warning/10")}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 font-semibold text-sm">
                          <span className="w-7 h-7 shrink-0 rounded-full bg-secondary grid place-items-center text-xs font-bold">
                            {p.used}
                          </span>
                          <Name users={users} id={p.user_id} />
                        </div>
                        <div dir="ltr" className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                          {p.quota != null && (
                            <span>
                              <b className="text-foreground">{p.used}</b>/{p.quota} bids
                              {p.extra > 0 && <span className="text-info"> (+{p.extra} bought)</span>}
                            </span>
                          )}
                          {p.burned > 0 && <span className="text-warning font-semibold">{p.burned} burned</span>}
                          {(p.fees > 0 || p.creditsSpend > 0) && <span>{currency}{money(p.fees + p.creditsSpend)} paid</span>}
                        </div>
                      </div>
                      {p.bids.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.bids.map((b) => <NumberChip key={b.id} bid={b} currency={currency} />)}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No bids yet</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="bids" className="mt-4">
              {s.live.length === 0 ? <Empty text="No bids yet" /> : <BidRows rows={s.live} users={users} currency={currency} />}
            </TabsContent>

            <TabsContent value="archive" className="mt-4 space-y-4">
              {archivedGroups.length === 0 ? (
                <Empty text="No archived rounds" />
              ) : (
                archivedGroups.map(([round, rows]) => (
                  <div key={round} className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Archive className="w-3.5 h-3.5" />Round {round} · {rows.length} bids
                    </p>
                    <BidRows rows={rows} users={users} currency={currency} />
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BidRows({ rows, users, currency }) {
  const sorted = [...rows].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  return (
    <div className="rounded-xl border border-border divide-y divide-border/60 max-h-[420px] overflow-y-auto">
      {sorted.map((b, i) => (
        <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 shrink-0 rounded-full bg-secondary text-muted-foreground text-xs font-bold grid place-items-center">
              {sorted.length - i}
            </span>
            <Name users={users} id={b.user_id} />
            {b.burned && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                <Flame className="w-3 h-3" />Burned
              </span>
            )}
          </span>
          <span className="shrink-0 text-end">
            <span className={cn("font-semibold tabular-nums", b.burned && "line-through text-muted-foreground")}>
              {currency}{money(b.amount)}
            </span>
            <span className="block text-[11px] text-muted-foreground">{time(b.created_date)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />{label}
      </p>
      <p dir="ltr" className="font-heading text-lg font-bold mt-1 tabular-nums truncate">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

function Empty({ text }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
