import React from "react";
import { Link } from "react-router-dom";
import { IdCard, Wallet, CalendarDays, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useWallet } from "@/lib/useWallet";

export default function AccountInfoCard({ user, compact = false }) {
  const { t } = useI18n();
  const p = t.account.profile;
  const { symbol } = useCurrency();
  const { balance } = useWallet(user?.id);

  const joined = user?.created_date
    ? new Date(user.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const box = compact
    ? "rounded-2xl bg-card border border-border p-3 space-y-2 shadow-sm"
    : "rounded-2xl border border-border bg-card p-5 space-y-2";

  return (
    <div className={box}>
      <h2 className="font-heading text-base font-semibold flex items-center gap-2">
        <IdCard className="w-4 h-4 text-primary" /> {p.accountInfo}
      </h2>
      <Row icon={CalendarDays} label={p.memberSince} value={joined} />
      <Row icon={IdCard} label={p.accountId} value={(user?.id || "").slice(0, 8).toUpperCase() || "—"} />
      <Link
        to="/wallet"
        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 hover:shadow-sm transition"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Wallet className="w-3.5 h-3.5" /> {p.walletBalance}
        </span>
        <span className="flex items-center gap-1 text-sm font-bold">
          {`${symbol}${(balance || 0).toFixed(2)}`}
          <ChevronRight className={`w-4 h-4 text-muted-foreground ${""}`} />
        </span>
      </Link>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-sm font-bold truncate">{value}</span>
    </div>
  );
}
