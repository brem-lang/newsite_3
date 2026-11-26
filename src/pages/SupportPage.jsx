import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, CircleHelp, Mail, MessageCircle, Wallet, Gavel, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function SupportPage() {
  const { dir } = useI18n();
  const L = (copy) => (copy.en);

  const items = [
    {
      icon: Wallet,
      q: "How do I add money to my wallet?",
      a: "Go to Wallet → Deposit, choose an amount, and complete the payment. Your balance updates automatically.",
    },
    {
      icon: Gavel,
      q: "How does bidding work?",
      a: "Each auction shows its entry fee and bid increment. Joining gives you a quota of bids based on those values. Place bids until the auction closes.",
    },
    {
      icon: Trophy,
      q: "I won an auction. What is next?",
      a: "Open the closed auction, view the winner details, and follow the payment instructions to claim your item.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="h-14 px-2 flex items-center gap-1">
          <Link
            to="/account"
            aria-label={"Back"}
            className="w-10 h-10 rounded-xl grid place-items-center text-foreground active:scale-95 transition"
          >
            <ChevronLeft className={cn("w-5 h-5")} />
          </Link>
          <h1 className="flex-1 text-center font-display font-extrabold text-[15px] text-foreground truncate px-1">
            {"Help & support"}
          </h1>
          <div className="w-10" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="mx-4 mt-3 rounded-xl bg-card border border-primary/30 shadow-[0_14px_34px_-26px_hsl(var(--primary)/0.45)] p-4">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
            <CircleHelp className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {"Find answers below or reach out to our team. We usually reply within one business day."}
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
              <p className="text-[13px] font-bold text-foreground truncate">{"Email support"}</p>
              <p className="text-[11px] text-muted-foreground truncate">support@ascendauction.example</p>
            </div>
            <ChevronLeft className={cn("h-4 w-4 shrink-0 text-muted-foreground/55")} />
          </a>
          <a
            href="https://wa.me/000000000000"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-secondary/70 transition"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground truncate">{"WhatsApp"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{"Chat with us"}</p>
            </div>
            <ChevronLeft className={cn("h-4 w-4 shrink-0 text-muted-foreground/55")} />
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
            {"Terms"}
          </Link>
          <Link
            to="/privacy"
            className="h-12 rounded-lg bg-card border border-border grid place-items-center text-[13px] font-bold text-foreground active:scale-95 transition"
          >
            {"Privacy"}
          </Link>
        </div>
      </main>
    </div>
  );
}
