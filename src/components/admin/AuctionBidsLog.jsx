import React, { useMemo, useState } from "react";
import { ChevronDown, Gavel, Archive, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { auctionBidsQuery } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Full bid history for one auction: current (live) round plus every archived
 * round, with the bidder identity resolved from the users map.
 */
const NO_BIDS = [];

export default function AuctionBidsLog({ auction, users = {}, defaultOpen = false, refreshKey }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  // Same cached query the results table uses for its bid counts.
  const { data: bids = NO_BIDS, isFetching: loading } = useQuery({ ...auctionBidsQuery(auction?.id), enabled: open && !!auction?.id });
  void refreshKey; // the parent refresh invalidates the shared query directly

  const groups = useMemo(() => {
    const byRound = new Map();
    bids.forEach((b) => {
      const r = Number(b.round || 1);
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(b);
    });
    return [...byRound.entries()].sort((a, b) => b[0] - a[0]);
  }, [bids]);

  const name = (b) => {
    const u = users[b.user_id];
    if (u) return u.full_name || u.email || `…${String(b.user_id).slice(-6)}`;
    return `…${String(b.user_id || "").slice(-6)}`;
  };

  const currency = t?.common?.currency || "$";
  const labels = {
    all: t?.admin?.live?.bids || "Bids",
    none: t?.admin?.live?.noBids || "No bids yet",
    round: t?.auction?.round || "Round",
    live: t?.auction?.statusLive || "Live",
    archived: t?.admin?.results?.archived || "Archived",
  };

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-sm font-semibold hover:bg-secondary/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Gavel className="w-4 h-4 text-muted-foreground" />
          {labels.all}
          {bids.length > 0 && <span className="text-xs font-normal text-muted-foreground">({bids.length})</span>}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {loading && bids.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">…</p>
          ) : bids.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{labels.none}</p>
          ) : (
            groups.map(([round, rows]) => {
              const isArchived = rows.every((r) => r.archived);
              return (
                <div key={round} className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>{labels.round} {round}</span>
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full normal-case tracking-normal font-semibold",
                      isArchived ? "bg-secondary text-muted-foreground" : "bg-success/15 text-success"
                    )}>
                      {isArchived && <Archive className="w-3 h-3" />}
                      {isArchived ? labels.archived : labels.live}
                    </span>
                    <span className="font-normal normal-case tracking-normal">· {rows.length}</span>
                  </div>
                  <div className="rounded-xl border border-border divide-y divide-border/60 max-h-64 overflow-y-auto">
                    {rows.map((b, i) => (
                      <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-secondary text-muted-foreground text-xs font-bold grid place-items-center">
                            {rows.length - i}
                          </span>
                          <span className="truncate">{name(b)}</span>
                          {b.burned && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                              <Flame className="w-3 h-3" />{t?.auction?.sealedBurnedTag || "Burned"}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-end">
                          <span className={cn("font-semibold", b.burned && "line-through text-muted-foreground")}>{currency}{Number(b.amount || 0).toFixed(2)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {b.created_date ? new Date(b.created_date).toLocaleString("en-GB") : ""}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
