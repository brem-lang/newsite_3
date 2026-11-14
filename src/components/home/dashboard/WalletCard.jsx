import React from "react";
import { Link } from "react-router-dom";
import { Plus, Wallet as WalletIcon, Users, Gavel } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Compact screen-04 balance strip. */
export default function WalletCard({ balance = 0, joined = 0, activeBids = 0 }) {
  const { t } = useI18n();
  const amount = Number(balance || 0);
  const long = Math.abs(amount) >= 100000;

  return (
    <section className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,hsl(var(--surface)),hsl(var(--card)))] p-4 text-foreground shadow-[0_18px_45px_-30px_hsl(var(--accent)/0.8)]">
      <span className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full border border-accent/10 bg-accent/5" />
      <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><WalletIcon className="h-5 w-5" /></span>
          <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground">
            {t.nav.balance}
          </p>
          <p
            className={`mt-1 truncate font-display font-extrabold leading-none text-primary tabular-nums ${
              long ? "text-[1.35rem]" : "text-[1.65rem]"
            }`}
          >
            {t.common.currency}{amount.toFixed(2)}
          </p>
          </div>
        </div>
        <Link
          to="/deposit"
          className="tap-44 cyan-button shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 text-[12px] font-extrabold transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          {t.dash.deposit}
        </Link>
      </div>

      <div className="relative mt-3 grid min-w-0 grid-cols-2 gap-2 border-t border-border/60 pt-3">
        {[
          { icon: Users, value: joined, label: t.dash.seatsJoined },
          { icon: Gavel, value: activeBids, label: t.dash.activeBids },
        ].map((s, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold leading-none tabular-nums">{s.value}</span>
              <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider opacity-75">{s.label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
