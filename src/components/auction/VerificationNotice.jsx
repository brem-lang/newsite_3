import React from "react";
import { Link } from "@tanstack/react-router";
import { Clock, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shown in place of the Join button while the member's account is not yet
 * verified. Members can't submit anything themselves (an admin approves
 * them in Admin → Verification), so it explains the wait, or the rejection
 * with the admin's note, and points to support.
 */
export default function VerificationNotice({ user, compact = false }) {
  const { t } = useI18n();
  const a = t.auction;
  const rejected = user?.verification_status === "rejected";
  const Icon = rejected ? ShieldAlert : Clock;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border flex items-start gap-2.5",
        compact ? "p-3 text-[13px]" : "p-4 text-sm",
        rejected ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-warning/10 border-warning/30 text-warning"
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold">{rejected ? a.verifyRejectedTitle : a.verifyNoticeTitle}</p>
        <p className="text-xs mt-0.5 opacity-90">{rejected ? a.verifyRejectedText : a.verifyPendingText}</p>
        {rejected && user?.verification_note ? (
          <p className="mt-1.5 text-xs">
            <span className="font-semibold">{a.verifyNoteLabel}:</span> {user.verification_note}
          </p>
        ) : null}
        <Link to="/support" className="inline-block mt-1.5 text-xs font-bold underline">
          {a.verifyContactSupport}
        </Link>
      </div>
    </div>
  );
}
