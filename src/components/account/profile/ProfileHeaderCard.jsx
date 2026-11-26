import React from "react";
import { BadgeCheck, ShieldAlert, Clock3, Mail, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { displayVerification } from "@/lib/verification";

const STATUS = {
  verified: { icon: BadgeCheck, cls: "bg-success/15 text-success border-success/30", key: "verified" },
  pending: { icon: Clock3, cls: "bg-warning/15 text-warning border-warning/30", key: "pending" },
  unverified: { icon: ShieldAlert, cls: "bg-muted text-muted-foreground border-border", key: "unverified" },
  // Staff accounts never need verification (joinAuction / placeBid skip it).
  staff: { icon: BadgeCheck, cls: "bg-primary/10 text-primary border-primary/30", key: "staff" },
};

export default function ProfileHeaderCard({ user }) {
  const { t } = useI18n();
  const p = t.account.profile;
  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.full_name ||
    user?.email ||
    "";
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("") || "?";

  const status = STATUS[displayVerification(user, "unverified")] || STATUS.unverified;
  const StatusIcon = status.icon;
  const country = user?.country || countryName(user?.country_code, "en");
  const since = user?.created_date
    ? new Date(user.created_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-bold text-xl shadow-[0_0_22px_hsl(var(--primary)/0.18)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold truncate">{name}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
            <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{user?.email}</span>
          </p>
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", status.cls)}>
              <StatusIcon className="w-3 h-3" /> {p[status.key]}
            </span>
            {country && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground">
                <Globe className="w-3 h-3" /> {country}
              </span>
            )}
            {since && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground">
                {p.memberSince} {since}
              </span>
            )}
          </div>
        </div>
      </div>

      {user?.verification_note && (
        <div className="mt-3 rounded-xl bg-muted/60 border border-border p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{p.verificationNote}</p>
          <p className="text-xs mt-0.5">{user.verification_note}</p>
        </div>
      )}
    </div>
  );
}
