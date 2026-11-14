import React from "react";
import { motion } from "framer-motion";
import { formatCountdownRing } from "@/lib/auction";
import { useI18n } from "@/lib/i18n";

export default function CountdownRing({ remaining, total, status }) {
  const { t } = useI18n();
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const R = 54;
  const C = 2 * Math.PI * R;
  const low = status === "live" && remaining < 30000;
  const color = status !== "live" ? "hsl(var(--muted-foreground))" : low ? "hsl(var(--destructive))" : "hsl(var(--primary))";
  const text = status === "live" ? formatCountdownRing(remaining) : "--:--";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - frac) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center overflow-visible">
          <div className="px-3">
            <p className={`font-extrabold leading-tight whitespace-normal break-words ${text.length > 8 ? "text-[11px] tracking-tight" : text.length > 5 ? "text-lg" : "text-xl"} ${text.length > 8 ? "font-sans" : "font-mono"} ${low ? "text-destructive" : "text-primary"}`}>{text}</p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{t.auction.timeRemaining}</p>
          </div>
        </div>
      </div>
    </div>
  );
}