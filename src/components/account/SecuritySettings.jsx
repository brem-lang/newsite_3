import React, { useState } from "react";
import { ShieldCheck, Mail, IdCard, CalendarDays, KeyRound, BadgeCheck, Clock3, ShieldAlert, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import ChangePassword from "@/components/account/ChangePassword";
import { Button } from "@/components/ui/button";

const STATUS = {
  verified: { icon: BadgeCheck, cls: "bg-success/10 text-success border-success/30" },
  pending: { icon: Clock3, cls: "bg-warning/10 text-warning border-warning/30" },
  unverified: { icon: ShieldAlert, cls: "bg-muted text-muted-foreground border-border" }
};

export default function SecuritySettings({ user }) {
  const { t, dir } = useI18n();
  const p = t.account.profile;
  const L = (o) => (dir === "rtl" ? o.ar : o.en);
  const [showPw, setShowPw] = useState(false);

  const status = STATUS[user?.verification_status] || STATUS.unverified;
  const StatusIcon = status.icon;
  const joined = user?.created_date
    ? new Date(user.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="space-y-4">
      {/* Verification status banner */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-base font-semibold">{p.securityOverview}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{p.securityOverviewSubtitle}</p>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border", status.cls)}>
          <StatusIcon className="w-3.5 h-3.5" /> {p[user?.verification_status] || p.unverified}
        </span>
      </div>

      {/* Security info rows */}
      <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
        <Row icon={Mail} label={p.signInEmail} value={user?.email || "—"} />
        <Row icon={IdCard} label={p.accountId} value={(user?.id || "").slice(0, 8).toUpperCase() || "—"} />
        <Row icon={CalendarDays} label={p.memberSince} value={joined} />
      </div>

      {/* Change password entry */}
      {showPw ? (
        <ChangePassword user={user} />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowPw(true)}
          className="h-auto w-full justify-start gap-3 p-4 text-start whitespace-normal"
        >
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-sm font-semibold">{p.changePassword}</span>
            <span className="block text-xs text-muted-foreground truncate">{p.changePasswordSubtitle}</span>
          </span>
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground shrink-0", dir === "rtl" && "rotate-180")} />
        </Button>
      )}
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
