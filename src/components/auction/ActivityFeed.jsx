import React from "react";
import { AnimatePresence, m } from "framer-motion";
import { useI18n } from "@/lib/i18n";

function dirX() {
  return 20;
}

export default function ActivityFeed({ bids, currentUserId, names = {} }) {
  const { t } = useI18n();
  const rows = [...(bids || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 8);
  return (
    <div className="native-panel rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
        <h2 className="font-display text-lg font-bold text-foreground">{t.auction.activity}</h2>
      </div>
      <div className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {rows.length === 0 ? (
            <div key="empty" className="p-8 text-center text-sm text-muted-foreground">{t.auction.activityEmpty}</div>
          ) : rows.map((b) => {
            const mine = b.user_id === currentUserId;
            return (
              <m.div key={b.id} layout initial={{ opacity: 0, x: dirX() }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${mine ? "bg-accent" : "bg-primary"}`} />
                  <span className={`text-sm ${mine ? "font-bold text-accent" : "text-muted-foreground"}`}>{mine ? t.auction.you : (names?.[b.user_id] || `User …${(b.user_id || "").slice(-4)}`)}</span>
                </div>
                <span className="font-bold tabular-nums text-primary">{t.common.currency}{Number(b.amount).toFixed(2)}</span>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}