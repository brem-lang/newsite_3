import React from "react";
import { Link } from "@tanstack/react-router";
import { Radio, Timer, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Three real counts that show the site is busy right now. A count of zero is
 * left out instead of shown, so the strip never reads as empty; with nothing
 * live it doesn't render at all.
 */
export default function PulseStrip({ pulse, compact = false }) {
  const { t } = useI18n();
  if (!pulse || pulse.live === 0) return null;

  const items = [
    { icon: Radio, value: pulse.live, label: t.dash.pulseLive, tone: "text-destructive", dot: true },
    { icon: Timer, value: pulse.endingWithinHour, label: t.dash.pulseHour, tone: "text-primary" },
    { icon: Users, value: pulse.seatsInPlay, label: t.dash.pulseSeats, tone: "text-accent" },
  ].filter((i) => i.value > 0);

  return (
    <Link
      to="/auctions"
      className={cn(
        "grid min-w-0 divide-x divide-border rounded-xl border border-border bg-card transition-colors hover:border-accent/50 rtl:divide-x-reverse",
        items.length === 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1"
      )}
    >
      {items.map(({ icon: Icon, value, label, tone, dot }) => (
        <div key={label} className={cn("flex min-w-0 items-center gap-2.5", compact ? "flex-col gap-1 px-2 py-2.5 text-center" : "px-4 py-3")}>
          <span className={cn("relative grid shrink-0 place-items-center", tone)}>
            {dot ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
            ) : null}
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className={cn("block font-display font-extrabold leading-none text-foreground tabular-nums", compact ? "text-base" : "text-lg")}>{value}</span>
            <span className={cn("mt-0.5 block truncate font-semibold text-muted-foreground", compact ? "text-[9px]" : "text-[11px]")}>{label}</span>
          </span>
        </div>
      ))}
    </Link>
  );
}
