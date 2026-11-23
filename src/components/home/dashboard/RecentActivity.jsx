import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gavel, Radio } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useNow } from "@/lib/useNow";
import ActivityList from "@/components/home/dashboard/ActivityList";
import { cn } from "@/lib/utils";

const FRESH_MS = 10_000; // a bid this new is highlighted

/** "now", "12s ago", "4m ago", "2h ago", then a date. */
function ago(ts, now, t) {
  const d = t.dash;
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return d.agoNow;
  if (s < 60) return d.agoSec.replace("{n}", s);
  const m = Math.floor(s / 60);
  if (m < 60) return d.agoMin.replace("{n}", m);
  const h = Math.floor(m / 60);
  if (h < 24) return d.agoHour.replace("{n}", h);
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Everyone's newest bids on live auctions, as they arrive (realtime). */
function BidFeed({ bids, auctionsById, userId, limit, fill }) {
  const { t } = useI18n();
  const now = useNow(bids.length > 0);
  const rows = bids.filter((b) => auctionsById[b.auction_id]).slice(0, limit);

  if (rows.length === 0) {
    return (
      <div className="grid h-full min-h-40 place-items-center p-6 text-center">
        <div>
          <Radio className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.dash.noBids}</p>
          <Link to="/auctions" className="mt-2 inline-block text-xs font-bold text-primary">{t.home.browse}</Link>
        </div>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-border", fill && "h-full overflow-y-auto overscroll-contain")} aria-live="polite">
      {rows.map((b) => {
        const auction = auctionsById[b.auction_id];
        const ts = new Date(b.created_date || 0).getTime();
        const mine = !!userId && b.user_id === userId;
        const fresh = now - ts < FRESH_MS;
        return (
          <li key={b.id}>
            <Link
              to="/auction/$id"
              params={{ id: b.auction_id }}
              className={cn(
                "flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/60",
                fresh && "bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold",
                  mine ? "bg-primary text-primary-foreground" : "bg-accent/12 text-accent"
                )}
              >
                {mine ? t.dash.youShort : <Gavel className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-foreground">
                  <span className="font-bold">{mine ? t.auction.you : t.dash.someone}</span>{" "}
                  {t.dash.bidOn}{" "}
                  <span className="font-semibold">{auction.title}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                  {fresh ? <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" /> : null}
                  {ago(ts, now, t)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-primary tabular-nums">
                {t.common.currency}{Number(b.amount || 0).toFixed(2)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Recent activity on /home: "Live bids" (everyone's bids on live auctions,
 * names hidden, sealed auctions never included) and "Your wallet" (the
 * user's own transactions). `fill` makes the list take the parent's height
 * and scroll inside it (desktop, beside the spotlight).
 */
export default function RecentActivity({
  bids = [],
  auctionsById = {},
  userId = null,
  transactions = [],
  walletLoading = false,
  showWallet = true,
  limit = 20,
  fill = false,
  className,
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState("bids");
  const tabs = [
    { id: "bids", label: t.dash.liveBids, live: true },
    ...(showWallet ? [{ id: "wallet", label: t.dash.yourWallet }] : []),
  ];

  return (
    <section className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-[15px] font-extrabold text-foreground">{t.dash.activity}</h2>
        {tabs.length > 1 ? (
          <div className="flex gap-1 rounded-lg bg-secondary/70 p-0.5" role="tablist">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => setTab(x.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors",
                  tab === x.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.live ? <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" /> : null}
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={cn("min-w-0", fill && "relative min-h-64 flex-1")}>
        <div className={cn(fill && "lg:absolute lg:inset-0")}>
          {tab === "bids" ? (
            <BidFeed bids={bids} auctionsById={auctionsById} userId={userId} limit={limit} fill={fill} />
          ) : (
            <div className={cn("p-3", fill && "h-full overflow-y-auto overscroll-contain")}>
              <ActivityList transactions={transactions} loading={walletLoading} limit={limit} />
              <Link to="/wallet" className="mt-3 block text-center text-xs font-bold text-primary hover:underline">
                {t.dash.seeAll}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
