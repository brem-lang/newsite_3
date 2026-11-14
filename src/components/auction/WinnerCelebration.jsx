import React, { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { useI18n } from "@/lib/i18n";
import { Image } from "@/components/ui/image";

export default function WinnerCelebration({ status, auction, userId }) {
  const { t } = useI18n();
  const fired = useRef(false);
  const won = status === "ended" && auction?.winner_id === userId;

  useEffect(() => {
    if (won && !fired.current) {
      fired.current = true;
      const end = Date.now() + 2200;
      (function frame() {
        confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors: ["#2563EB", "#F97316", "#16A34A"] });
        confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors: ["#2563EB", "#F97316", "#16A34A"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors: ["#2563EB", "#F97316", "#16A34A"] });
    }
  }, [won]);

  if (!won) return null;
  return (
    <div className="native-panel rounded-xl border-primary/50 p-6 space-y-4 shadow-[0_0_30px_hsl(var(--primary)/0.14)]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Trophy className="w-6 h-6" /></div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-primary">{t.auction.winTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.auction.winSub}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/50 p-4">
        {auction?.image_url && <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-muted"><Image src={auction.image_url} alt={auction.title} className="w-full h-full" fittingType="fill" /></div>}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.auction.prize}</p>
          <p className="font-display font-bold text-foreground">{auction?.title}</p>
          <p className="font-display text-xl font-extrabold text-success">{t.common.currency}{(auction?.current_price || 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}