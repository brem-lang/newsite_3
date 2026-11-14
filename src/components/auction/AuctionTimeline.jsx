import React from "react";
import { Ticket, Gavel, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Compact, plain-language explainer: join -> bid -> winner,
 * with a single sentence describing when the auction closes.
 */
export default function AuctionTimeline({ auction, status, className }) {
  const { t } = useI18n();
  if (!auction) return null;

  const quota =
    Number(auction.min_participants || 0) ||
    Number(auction.max_subscribers || 0) ||
    0;

  const sentence = quota
    ? t.auction.timelineSimple.replace("{quota}", quota)
    : t.auction.timelineSimpleNoQuota;

  const activeIndex = status === "ended" ? 2 : status === "live" ? 1 : 0;

  const steps = [
    { icon: Ticket, label: t.auction.stepShortJoin },
    { icon: Gavel, label: t.auction.stepShortLive },
    { icon: Trophy, label: t.auction.stepShortClose }
  ];

  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-3", className)}
      role="group"
      aria-label={t.auction.timelineTitle}
    >
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const active = i <= activeIndex;
          const Icon = s.icon;
          return (
            <React.Fragment key={i}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-7 h-7 shrink-0 rounded-full grid place-items-center",
                    active ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span
                  className={cn(
                    "text-[12px] font-semibold truncate",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex-1 h-px",
                    i < activeIndex ? "bg-blue-600" : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-snug mt-2.5">{sentence}</p>
    </div>
  );
}
