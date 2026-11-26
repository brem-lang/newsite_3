import React, { useState } from "react";
import { Copy, Eye, Minus, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminKeys } from "@/lib/queries/keys";
import { useAdminUsersByIds } from "@/lib/queries/admin";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NONE = [];

/** Every top-up waiting for staff. */
const pendingQuery = () => ({
  queryKey: [...adminKeys.paymentsAll(), "pendingTopups"],
  queryFn: async () =>
    (await base44.entities.WalletTransaction.filter({ status: "pending", type: "topup" }, "-created_date", 200)) || [],
  staleTime: 15_000,
});

function timeAgo(value) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * Admin → Payments: the top-up approvals queue. One compact row per request
 * (the list scrolls on its own past a few rows); "Details" opens the full
 * request and the member's contact details. Approve asks to confirm; reject asks for
 * an optional reason, which the member is told.
 */
export default function AdminTopupApprovals() {
  const { t } = useI18n();
  const a = t.admin.approvals;
  const qc = useQueryClient();
  const askConfirm = useConfirm();
  const { data: pending = NONE } = useQuery(pendingQuery());
  const users = useAdminUsersByIds(pending.map((x) => x.user_id), "*");
  const [deciding, setDeciding] = useState("");
  const [viewing, setViewing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const money = (v) => `${t.common.currency}${Math.abs(Number(v || 0)).toFixed(2)}`;
  const nameOf = (x) => {
    const u = users[x.user_id];
    return u ? u.full_name || u.email : `…${x.user_id?.slice(-4)}`;
  };

  const decide = async (txn, decision, why = "") => {
    setDeciding(txn.id);
    try {
      const res = await base44.functions.invoke("approveTopup", { transaction_id: txn.id, decision, reason: why });
      if (res.data?.error) { toast.error(res.data.error); return false; }
      toast.success(decision === "approve" ? t.admin.payments.approvedTx : t.admin.payments.rejectedTx);
      qc.invalidateQueries({ queryKey: adminKeys.paymentsAll() });
      return true;
    } catch (e) {
      toast.error(e.message || "Error");
      return false;
    } finally {
      setDeciding("");
    }
  };

  const approve = async (txn) => {
    const ok = await askConfirm({
      title: a.approveTitle,
      description: a.approveText.replace("{amount}", money(txn.amount)).replace("{name}", nameOf(txn)),
      confirmLabel: t.admin.payments.approve,
    });
    if (ok && (await decide(txn, "approve"))) setViewing(null);
  };

  const openReject = (txn) => {
    setViewing(null);
    setRejecting(txn);
    setReason("");
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (await decide(rejecting, "reject", reason.trim())) setRejecting(null);
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(a.copied);
    } catch {
      toast.error("Error");
    }
  };

  if (!pending.length) return null;

  const view = viewing ? pending.find((x) => x.id === viewing.id) || viewing : null;
  const viewUser = view ? users[view.user_id] : null;
  // Only what's already stored: the transaction and the member's profile.
  const details = view
    ? [
        { label: a.method, value: view.description || view.provider },
        { label: a.reference, value: view.reference, copy: true },
        { label: a.phone, value: viewUser?.phone, copy: true },
        { label: a.email, value: viewUser?.email, copy: true },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-2">
      <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-warning">
        {t.admin.payments.approvals}
        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-warning/20 text-warning">{pending.length}</span>
      </h3>

      {/* Fixed height: past ~5 rows the list scrolls instead of pushing the page down. */}
      <div className="max-h-[17rem] overflow-y-auto -mx-1 px-1 divide-y divide-warning/15">
        {pending.map((x) => {
          const busy = deciding === x.id;
          return (
            <div key={x.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{nameOf(x)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {money(x.amount)} · {x.reference || "—"} · {timeAgo(x.created_date)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setViewing(x)}>
                  <Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline">{a.details}</span>
                </Button>
                <Button size="sm" className="h-8 gap-1" disabled={busy} onClick={() => approve(x)}>
                  <Plus className="w-3.5 h-3.5" />{t.admin.payments.approve}
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => openReject(x)}>
                  <Minus className="w-3.5 h-3.5" />{t.admin.payments.reject}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent size="sm">
          {view ? (
            <>
              <DialogHeader>
                <DialogTitle>{a.detailsTitle}</DialogTitle>
                <DialogDescription>
                  {nameOf(view)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">{a.amount}</span>
                <span className="font-heading text-2xl font-extrabold">{money(view.amount)}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <dt className="text-[11px] text-muted-foreground">{d.label}</dt>
                    <dd className="flex items-center gap-1 min-w-0">
                      <span className={cn("truncate font-medium", !d.value && "font-normal text-muted-foreground")} dir={d.copy ? "ltr" : undefined}>
                        {d.value || "—"}
                      </span>
                      {d.copy && d.value ? (
                        <button type="button" onClick={() => copy(d.value)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`${a.copy} ${d.label}`}>
                          <Copy className="w-3 h-3" />
                        </button>
                      ) : null}
                    </dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="text-[11px] text-muted-foreground">{a.submitted}</dt>
                  <dd className="font-medium">
                    {new Date(view.created_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {timeAgo(view.created_date)}
                  </dd>
                </div>
              </dl>

              <DialogFooter>
                <Button type="button" variant="outline" className="gap-1" disabled={deciding === view.id} onClick={() => openReject(view)}>
                  <Minus className="w-3.5 h-3.5" />{t.admin.payments.reject}
                </Button>
                <Button type="button" className="gap-1" disabled={deciding === view.id} onClick={() => approve(view)}>
                  <Plus className="w-3.5 h-3.5" />{t.admin.payments.approve}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reject with an optional reason */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent size="sm">
          <DialogForm onSubmit={(e) => { e.preventDefault(); confirmReject(); }}>
            <DialogHeader>
              <DialogTitle>{a.rejectTitle}</DialogTitle>
              {rejecting ? <DialogDescription>{money(rejecting.amount)} · {nameOf(rejecting)}</DialogDescription> : null}
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="topup-reject-reason">{a.reason}</Label>
              <Input id="topup-reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={a.reasonHint} />
              <p className="text-xs text-muted-foreground">{a.reasonNote}</p>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" variant="destructive" disabled={!!deciding}>{t.admin.payments.reject}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
