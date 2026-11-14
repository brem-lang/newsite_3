import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, CircleHelp, Mail, MessageCircle, Wallet, Gavel, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SupportPage() {
  const { lang, dir } = useI18n();
  const L = (copy) => (dir === "rtl" ? copy.ar : copy.en);

  const items = [
    {
      icon: Wallet,
      q: L({ en: "How do I add money to my wallet?", ar: "كيف أضيف رصيداً إلى محفظتي؟" }),
      a: L({
        en: "Go to Wallet → Deposit, choose an amount, and complete the payment. Your balance updates automatically.",
        ar: "انتقل إلى المحفظة → إيداع، اختر المبلغ، وأكمل الدفع. يتم تحديث رصيدك تلقائياً.",
      }),
    },
    {
      icon: Gavel,
      q: L({ en: "How does bidding work?", ar: "كيف تعمل المزايدة؟" }),
      a: L({
        en: "Each auction shows its entry fee and bid increment. Joining gives you a quota of bids based on those values. Place bids until the auction closes.",
        ar: "يظهر لكل مزاد رسوم الدخول ومقدار الزيادة. عند الانضمام تحصل على حصة من المزايدات بناءً عليهما. ضع مزايداتك حتى إغلاق المزاد.",
      }),
    },
    {
      icon: Trophy,
      q: L({ en: "I won an auction. What is next?", ar: "لقد فزت بمزاد. ما الخطوة التالية؟" }),
      a: L({
        en: "Open the closed auction, view the winner details, and follow the payment instructions to claim your item.",
        ar: "افتح المزاد المغلق، اعرض تفاصيل الفائز، واتبع تعليمات الدفع لاستلام السلعة.",
      }),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="h-14 px-2 flex items-center gap-1">
          <Link
            to="/account"
            aria-label={lang === "ar" ? "رجوع" : "Back"}
            className="w-10 h-10 rounded-xl grid place-items-center text-foreground active:scale-95 transition"
          >
            <ChevronLeft className={cn("w-5 h-5", dir === "rtl" && "rotate-180")} />
          </Link>
          <h1 className="flex-1 text-center font-display font-extrabold text-[15px] text-foreground truncate px-1">
            {L({ en: "Help & support", ar: "مركز المساعدة" })}
          </h1>
          <div className="w-10 grid place-items-center">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="mx-4 mt-3 rounded-xl bg-card border border-primary/30 shadow-[0_14px_34px_-26px_hsl(var(--primary)/0.45)] p-4">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
            <CircleHelp className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {L({
              en: "Find answers below or reach out to our team. We usually reply within one business day.",
              ar: "ابحث عن إجابات أدناه أو تواصل مع فريقنا. نرد عادةً خلال يوم عمل واحد.",
            })}
          </p>
        </div>

        <div className="mx-4 mt-3 rounded-xl bg-card border border-border overflow-hidden">
          <a
            href="mailto:support@ascendauction.example"
            className="flex items-center gap-3 px-4 py-3.5 border-b border-border active:bg-secondary/70 transition"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{L({ en: "Email support", ar: "الدعم عبر البريد" })}</p>
              <p className="text-[11px] text-muted-foreground truncate">support@ascendauction.example</p>
            </div>
            <ChevronLeft className={cn("h-4 w-4 shrink-0 text-muted-foreground/55", dir === "rtl" && "rotate-180")} />
          </a>
          <a
            href="https://wa.me/000000000000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-secondary/70 transition"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{L({ en: "WhatsApp", ar: "واتساب" })}</p>
              <p className="text-[11px] text-muted-foreground truncate">{L({ en: "Chat with us", ar: "دردش معنا" })}</p>
            </div>
            <ChevronLeft className={cn("h-4 w-4 shrink-0 text-muted-foreground/55", dir === "rtl" && "rotate-180")} />
          </a>
        </div>

        <div className="mx-4 mt-3 space-y-2.5">
          {items.map((item, i) => (
            <section key={i} className="rounded-xl bg-card border border-border shadow-sm p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-bold text-[13px] text-foreground leading-snug">{item.q}</h2>
                  <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/terms"
            className="h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition"
          >
            {L({ en: "Terms", ar: "الشروط" })}
          </Link>
          <Link
            to="/privacy"
            className="h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition"
          >
            {L({ en: "Privacy", ar: "الخصوصية" })}
          </Link>
        </div>
      </main>
    </div>
  );
}
