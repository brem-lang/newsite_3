import React from "react";
import { CheckCircle2, Mail, MapPin, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function AboutBlock() {
  const { t } = useI18n();
  const cards = [
    { icon: Mail, label: t.site.contact.email, value: t.site.contact.emailValue },
    { icon: MapPin, label: t.site.contact.location, value: t.site.contact.locationValue },
    { icon: Clock, label: t.site.contact.hours, value: t.site.contact.hoursValue }
  ];
  return (
    <section id="about" className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-14 scroll-mt-20">
      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="native-panel rounded-xl p-4 sm:p-7">
          <h2 className="font-display text-base sm:text-xl font-extrabold tracking-tight text-foreground">{t.site.about.title}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3 sm:line-clamp-none">{t.site.about.text}</p>
          <ul className="mt-3 sm:mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-2">
            {t.site.about.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div id="contact" className="native-panel rounded-xl p-4 sm:p-7 scroll-mt-20">
          <h2 className="font-display text-base sm:text-xl font-extrabold tracking-tight text-foreground">{t.site.contact.title}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">{t.site.contact.subtitle}</p>
          <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-lg border border-border bg-muted/50 p-2.5 sm:p-3.5 space-y-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <p className="font-bold text-xs text-foreground break-words">{c.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
