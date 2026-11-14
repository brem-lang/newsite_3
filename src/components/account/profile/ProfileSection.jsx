import React, { useState } from "react";
import { KeyRound, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ProfileHeaderCard from "./ProfileHeaderCard";
import PersonalDetailsCard from "./PersonalDetailsCard";
import AddressCard from "./AddressCard";
import AccountInfoCard from "./AccountInfoCard";
import ChangePassword from "@/components/account/ChangePassword";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ProfileSection({ user, compact = false }) {
  const { t } = useI18n();
  const p = t.account.profile;
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <ProfileHeaderCard user={user} />

      <div className={compact ? "space-y-3" : "grid lg:grid-cols-2 gap-4 items-start"}>
        <PersonalDetailsCard user={user} compact={compact} />
        <div className={compact ? "space-y-3" : "space-y-4"}>
          <AddressCard user={user} compact={compact} />
          <AccountInfoCard user={user} compact={compact} />

          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start hover:shadow-sm transition"
          >
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold">{p.security}</span>
              <span className="block text-xs text-muted-foreground truncate">{p.securitySubtitle}</span>
            </span>
            <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 ${""}`} />
          </button>
        </div>
      </div>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> {p.security}
            </DialogTitle>
          </DialogHeader>
          <ChangePassword user={user} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
