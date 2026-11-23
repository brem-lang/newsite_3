import React from "react";
import { useQuery } from "@tanstack/react-query";
import { auctionHistoryQuery } from "@/lib/queries/admin";
import { describeEvent } from "@/lib/lifecycleEvents";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** One auction's audit trail: who started, ended, relaunched or archived it, and when. */
export default function AuctionHistory({ auctionId }) {
  const { t } = useI18n();
  const L = t.admin.lifecycle;
  const { data: entries = [], isPending } = useQuery(auctionHistoryQuery(auctionId));
  if (isPending) return null;

  return (
    <section className="native-panel rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-accent">{L.history}</h4>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{L.historyEmpty}</p>
      ) : (
        <ol className="max-h-56 space-y-2 overflow-y-auto">
          {entries.map((e) => {
            const ev = describeEvent(e, t);
            return (
              <li key={e.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className={cn("font-semibold", ev.recovered && "text-warning")}>{ev.label}</span>
                  {ev.detail && <span className="text-muted-foreground"> · {ev.detail}</span>}
                </div>
                <div className="shrink-0 text-end text-muted-foreground">
                  <div>{ev.who}</div>
                  <div className="tabular-nums">{new Date(e.created_date).toLocaleString("en-GB")}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
