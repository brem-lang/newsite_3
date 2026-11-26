import React, { useState } from "react";
import { BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { sendPaymentReminder } from "@/lib/messaging";
import { toast } from "sonner";

/**
 * Sends the winner an in-app "Payment reminder" (their bell shows "Pay now").
 * Only for a payment that is still pending. Once sent it stays disabled for
 * the rest of the visit so one click can't spam the member.
 */
export default function PaymentReminderButton({ payment, auction, size = "sm", className }) {
  const { t } = useI18n();
  const r = t.admin.reminder;
  const askConfirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!payment || payment.status !== "pending") return null;

  const send = async () => {
    const ok = await askConfirm({
      title: r.confirmTitle,
      description: r.confirmText,
      confirmLabel: r.send,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await sendPaymentReminder({
        userId: payment.user_id,
        payment,
        auctionTitle: auction?.title,
        auctionId: payment.auction_id,
        currency: t.common.currency,
      });
      setSent(true);
      toast.success(r.sent);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={send}
      disabled={busy || sent}
      className={className ? `gap-1.5 ${className}` : "gap-1.5"}
    >
      {sent ? <Check className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
      {sent ? r.sentShort : busy ? r.sending : r.button}
    </Button>
  );
}
