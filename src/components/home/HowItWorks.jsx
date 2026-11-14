import React from "react";
import { Wallet, Users, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Wallet, title: t.site.how.step1Title, text: t.site.how.step1 },
    { icon: Users, title: t.site.how.step2Title, text: t.site.how.step2 },
    { icon: Gavel, title: t.site.how.step3Title, text: t.site.how.step3 }
  ];
  return (
    <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12 scroll-mt-20">
      <div className="native-panel rounded-xl p-4 sm:p-7">
        <h2 className="font-display text-base sm:text-xl font-extrabold tracking-tight text-foreground">{t.site.how.title}</h2>
        <div className="mt-3 sm:mt-5 grid sm:grid-cols-3 gap-3 sm:gap-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-primary">0{i + 1}</span>
                    <h3 className="font-display font-bold text-sm text-foreground">{s.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2 sm:line-clamp-none">{s.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
