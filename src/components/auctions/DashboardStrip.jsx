import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Gavel, Trophy, Users, Plus, UserCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency, Money } from "@/lib/currency";
import { Button } from "@/components/ui/button";

export default function DashboardStrip({ user, balance, stats }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const navigate = useNavigate();
  const h = t.hub;
  const name = user?.full_name || (user?.email ? user.email.split("@")[0] : "");

  const chips = [
    { icon: Gavel, label: h.activeBids, value: stats.activeBids, color: "text-accent", ring: "ring-accent/30" },
    { icon: Trophy, label: h.wins, value: stats.wins, color: "text-primary", ring: "ring-primary/30" },
    { icon: Users, label: h.joined, value: stats.joined, color: "text-success", ring: "ring-success/30" },
  ];

  return (
    <div className="native-panel rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{h.greeting}, {name} 👋</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">{h.balance}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-4xl sm:text-5xl font-extrabold text-primary">
                <Money amount={balance} codeClassName="text-primary/60" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <div key={c.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/70 ring-1 ${c.ring}`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                  <span className="text-sm font-bold">{c.value}</span>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-row lg:flex-col items-stretch gap-2 shrink-0">
            <Button
              onClick={() => navigate({ to: "/wallet" })}
              className="gap-2 h-10 px-4"
            >
              <Plus className="w-4 h-4" /> {h.topUp}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/account" })}
              className="gap-2 h-10 px-4"
            >
              <UserCircle className="w-4 h-4" /> {h.account}
            </Button>
          </div>
        </div>
    </div>
  );
}