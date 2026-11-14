import React from "react";
import { Flame, Users, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function HomeStats({ liveCount, seatsFilled, topBid }) {
  const { t } = useI18n();
  const rows = [
    { icon: Flame, label: t.site.stats.live, value: liveCount },
    { icon: Users, label: t.site.stats.seats, value: seatsFilled },
    { icon: Gavel, label: t.site.stats.topBid, value: `${t.common.currency}${topBid.toFixed(0)}` }
  ];
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
      <div className="native-panel rounded-xl grid grid-cols-3 divide-x rtl:divide-x-reverse divide-border">
        {rows.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="p-3.5 sm:p-5 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center shrink-0"><Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary" /></div>
              <div className="min-w-0">
                <p className="font-display text-lg sm:text-2xl font-extrabold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
