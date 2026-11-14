import React from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Compact wallet activity feed, newest first. */
export default function ActivityList({ transactions = [], loading, limit = 6 }) {
  const { t, dir } = useI18n();
  const rows = (transactions || []).slice(0, limit);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5 text-center">
        <Receipt className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t.dash.noActivity}</p>
      </div>
    );
  }

  return (
    <div className="native-panel overflow-hidden rounded-xl divide-y divide-border">
      {rows.map((tx) => {
        const amount = Number(tx.amount || 0);
        const credit = amount >= 0;
        const date = tx.created_date ? new Date(tx.created_date) : null;
        return (
          <div key={tx.id} className="flex items-center gap-3 p-3">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                credit ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              )}
            >
              {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {tx.type === "topup" ? t.wallet.typeTopup : tx.description || tx.type || (credit ? t.wallet.typeTopup : t.wallet.typeWinning)}
                </span>
                {tx.status === "pending" ? (
                  <span className="shrink-0 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600">
                    {t.wallet.pending}
                  </span>
                ) : null}
              </span>
              {date ? (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "shrink-0 text-sm font-extrabold tabular-nums",
                credit ? "text-emerald-600" : "text-rose-600",
                dir === "rtl" && "text-start"
              )}
            >
              {credit ? "+" : "−"}{t.common.currency}{Math.abs(amount).toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
