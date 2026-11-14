import React from "react";
import { Gauge, Timer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const mmss = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

/**
 * Participant-side pace meter. Shows, for the 1 / 10 / 30 minute windows (plus
 * the window this auction actually enforces), how many bids are still allowed
 * and when the allowance resets. Windows are fixed (tumbling) in the database,
 * so the countdown here matches the backend exactly.
 */
export default function BidPaceMeter({ rate, onExpire, compact = false, className }) {
  const { t } = useI18n();
  const limit = Math.max(0, Number(rate?.limit || 0));
  const enforcedWindow = Math.max(1, Number(rate?.window_minutes || 0));
  const windows = Array.isArray(rate?.windows) ? rate.windows : [];

  // Local ticking mirror of the server-provided reset seconds.
  const [offset, setOffset] = React.useState(0);
  const baseRef = React.useRef(Date.now());
  React.useEffect(() => {
    baseRef.current = Date.now();
    setOffset(0);
  }, [rate]);
  React.useEffect(() => {
    const id = setInterval(() => setOffset(Math.floor((Date.now() - baseRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const rows = windows
    .filter((w) => [1, 10, 30].includes(Number(w.minutes)) || Number(w.minutes) === enforcedWindow)
    .map((w) => {
      const left = Math.max(0, Number(w.resets_in || 0) - offset);
      return { ...w, left };
    })
    .sort((a, b) => Number(a.minutes) - Number(b.minutes));

  // When any window boundary passes, ask the page to refetch the authoritative state.
  const expired = rows.some((r) => r.left <= 0);
  React.useEffect(() => {
    if (expired && typeof onExpire === "function") onExpire();
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  if (limit <= 0 || rows.length === 0) return null;

  return (
    <div className={cn("native-panel rounded-xl p-3", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-accent" />
          {t.auction.paceTitle || "Your bidding pace"}
        </p>
        <span className="text-[11px] font-bold text-muted-foreground" dir="ltr">
          {(t.auction.paceRule || "{limit} bids / {window} min")
            .replace("{limit}", String(limit))
            .replace("{window}", String(enforcedWindow))}
        </span>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3")}>
        {rows.map((w) => {
          const remaining = w.remaining === null || w.remaining === undefined ? limit : Number(w.remaining);
          const isEnforced = !!w.enforced;
          const blocked = isEnforced && remaining <= 0;
          return (
            <div
              key={w.minutes}
              className={cn(
                "rounded-lg border p-2 text-center",
                blocked
                  ? "border-destructive/30 bg-destructive/10"
                  : isEnforced
                    ? "border-accent/30 bg-accent/10"
                    : "border-border bg-muted/50"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground" dir="ltr">
                {Number(w.minutes)} {t.auction.paceMin || "min"}
              </p>
              <p
                className={cn("text-lg font-black leading-tight", blocked ? "text-destructive" : "text-foreground")}
                dir="ltr"
              >
                {remaining}
              </p>
              <p className="text-[10px] text-muted-foreground" dir="ltr">
                {Number(w.used || 0)}/{limit} · <Timer className="inline w-2.5 h-2.5 -mt-0.5" /> {mmss(w.left)}
              </p>
              {isEnforced && (
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                  {t.auction.paceEnforced || "Enforced"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {(t.auction.paceHint ||
          "Only the enforced window blocks bidding. It resets on a fixed schedule, so the countdown is exactly when your next bid is allowed.")}
      </p>
    </div>
  );
}
