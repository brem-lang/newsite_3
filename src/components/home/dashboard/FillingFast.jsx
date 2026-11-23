import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Image } from "@/components/ui/image";
import { seatsOf, seatsLeftOf, fill } from "@/lib/homeHighlights";
import { cn } from "@/lib/utils";

/**
 * Open auctions closest to full. An auction goes live the moment its last
 * seat is taken, so these are the next ones to start: each card leads with
 * how many seats are left and what a seat costs.
 */
export default function FillingFast({ auctions = [], compact = false }) {
  const { t } = useI18n();
  if (!auctions.length) return null;
  const d = t.dash;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-extrabold text-foreground lg:text-base">{d.fillingFast}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{d.fillingFastSub}</p>
        </div>
        <Link to="/auctions" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-accent">
          {d.seeAll}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className={cn("grid min-w-0 gap-3", compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4")}>
        {auctions.map((a) => {
          const filled = seatsOf(a);
          const max = Number(a.max_subscribers || 0);
          const left = seatsLeftOf(a);
          const pct = Math.min(100, (filled / Math.max(1, max)) * 100);
          return (
            <Link
              key={a.id}
              to="/auction/$id"
              params={{ id: a.id }}
              className="group relative min-w-0 overflow-hidden rounded-xl border border-border bg-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent/50 active:scale-[0.98]"
            >
              <div className="absolute inset-0 overflow-hidden bg-muted">
                <Image src={a.image_url} alt={a.title} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" fittingType="fill" />
              </div>
              <div className="relative h-20 sm:h-24">
                <span
                  className={cn(
                    "absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                    left <= 3 ? "bg-destructive text-destructive-foreground" : "bg-background/90 text-foreground"
                  )}
                >
                  {left === 1 ? d.seatLeft : fill(d.seatsLeft, { count: left })}
                </span>
              </div>
              <div className="photo-fade relative -mt-8 p-2.5 pt-8">
                <p className="truncate text-[12px] font-extrabold text-foreground">{a.title}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] font-bold">
                  <span className="inline-flex items-center gap-0.5 text-accent tabular-nums">
                    <Users className="h-3 w-3" />{filled}/{max}
                  </span>
                  {Number(a.entry_fee) > 0 ? (
                    <span className="text-muted-foreground tabular-nums">
                      {d.entry} <span className="text-foreground">{t.common.currency}{Number(a.entry_fee)}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
