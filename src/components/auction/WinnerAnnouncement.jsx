import React from "react";
import { Trophy, MinusCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

/** Prominent "who won" banner shown as soon as an auction ends. */
export default function WinnerAnnouncement({ auction, status, youWon = false }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  if (status !== "ended") return null;

  const name = auction?.winner_name || "";

  if (!auction?.winner_id) {
    return (
      <div className="native-panel rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
          <MinusCircle className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">{t.auction.noWinner}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-primary/50 bg-primary/10 p-4 shadow-[0_0_24px_hsl(var(--primary)/0.12)]"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Trophy className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">{t.auction.winner}</p>
          <p className="font-display text-xl font-extrabold text-foreground truncate">
            {youWon ? t.auction.winTitle : name || t.auction.wonBy}
          </p>
          <p className="text-sm font-semibold text-success">
            {symbol}{Number(auction?.current_price || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Progress toward the participant target that closes the auction. */
export function ParticipantQuota({ auction, status }) {
  const { t } = useI18n();
  if ((status !== "open" && status !== "live") || !auction) return null;
  const joined = (auction.subscriber_ids || []).length;
  const quota = Math.min(
    Number(auction.min_participants || auction.max_subscribers || 0) || Number(auction.max_subscribers || 0),
    Number(auction.max_subscribers || 0) || Number(auction.min_participants || 0)
  );
  const remaining = Math.max(0, quota - joined);
  const pct = quota ? Math.min(100, Math.round((joined / quota) * 100)) : 0;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 space-y-2" role="status" aria-live="polite">
      <p className="text-sm font-bold text-foreground">
        {remaining > 0
          ? t.auction.waitingParticipants.replace("{count}", remaining)
          : t.auction.waitingReady}
      </p>
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={joined}
        aria-valuemin={0}
        aria-valuemax={quota}
      >
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-accent">{t.auction.seatsValue.replace("{filled}", joined).replace("{max}", quota)}</p>
      <p className="text-[11px] text-muted-foreground">{t.auction.quotaHint}</p>
    </div>
  );
}

