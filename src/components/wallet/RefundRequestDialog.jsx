import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export default function RefundRequestDialog({ transaction, open, onOpenChange, onSubmitted }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setReason(""); }, [open]);

  const submit = async () => {
    if (!transaction) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("requestRefund", {
        original_transaction_id: transaction.id,
        reason
      });
      if (res.data?.error) {
        toast.error(res.data.error === "already_requested" ? t.refund.alreadyRequested : t.refund.notRefundable);
        return;
      }
      toast.success(t.refund.requested);
      onSubmitted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogForm onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <DialogHeader><DialogTitle>{t.refund.request}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t.common.currency}{Math.abs(transaction?.amount || 0).toFixed(2)}</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.refund.reason} rows={3} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy ? t.refund.submitting : t.refund.submit}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}