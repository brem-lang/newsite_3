import React, { useState } from "react";
import { RotateCcw, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, useAdminUserMap, toMap, adminSection, warmAdmin, adminLookups } from "@/lib/queries/admin";
import { logAdminAction } from "@/lib/adminAudit";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CLS = {
  pending: "bg-warning/15 text-warning", approved: "bg-success/15 text-success", rejected: "bg-destructive/15 text-destructive"
};

const NONE = [];
const NO_MAP = {};

const loadSection = async () => {
  const [r, x] = await Promise.all([
    base44.entities.RefundRequest.list("-created_date", 500),
    base44.entities.WalletTransaction.list("-created_date", 1000),
  ]);
  return { rows: r || [], txns: toMap(x) };
};

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["refunds"], loadSection), adminLookups.users());

export default function AdminRefunds() {
  const { t } = useI18n();
  const { data, isPending: loading, refresh: load } = useAdminData(["refunds"], loadSection);
  const rows = data?.rows ?? NONE;
  const txns = data?.txns ?? NO_MAP;
  const users = useAdminUserMap();
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");


  const decide = async (r, decision) => {
    setBusy(r.id + decision);
    try {
      const res = await base44.functions.invoke("resolveRefund", { request_id: r.id, decision, note: decision === "reject" ? note : "" });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction(`refund.${decision}`, { targetType: "refund_requests", targetId: r.id, details: note });
      toast.success(decision === "approve" ? t.admin.refunds.approved : t.admin.refunds.rejected);
      setRejecting(null); setNote("");
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy("");
    }
  };

  if (loading) return null;

  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><RotateCcw className="w-6 h-6" />{t.admin.refunds.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.refunds.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border"><h3 className="font-heading text-lg font-semibold">{t.admin.refunds.title}</h3></div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t.admin.refunds.empty}</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-4 py-3">{t.admin.refunds.colUser}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.refunds.colAmount}</th>
                  <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.refunds.colReason}</th>
                  <th className="text-end font-medium px-4 py-3">{t.admin.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.map((r) => {
                  const txn = txns[r.original_transaction_id];
                  const u = users[r.user_id];
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{u ? (u.full_name || u.email) : `…${r.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3">{t.common.currency}{Math.abs(txn?.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{r.reason || "—"}</td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" disabled={!!busy} onClick={() => decide(r, "approve")} className="gap-1"><Check className="w-3.5 h-3.5" />{t.admin.refunds.approve}</Button>
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setRejecting(r); setNote(""); }} className="gap-1"><X className="w-3.5 h-3.5" />{t.admin.refunds.reject}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="admin-table-scroll">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-4 py-3">{t.admin.refunds.colUser}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.refunds.colAmount}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.refunds.colStatus}</th>
                  <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.refunds.colNote}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resolved.map((r) => {
                  const txn = txns[r.original_transaction_id];
                  const u = users[r.user_id];
                  return (
                    <tr key={r.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{u ? (u.full_name || u.email) : `…${r.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3">{t.common.currency}{Math.abs(txn?.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={cn("inline-block text-xs font-semibold rounded-full px-2.5 py-1", STATUS_CLS[r.status])}>{t.refund.status[r.status]}</span></td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{r.admin_note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent size="sm">
          <DialogForm onSubmit={(e) => { e.preventDefault(); rejecting && decide(rejecting, "reject"); }}>
            <DialogHeader><DialogTitle>{t.admin.refunds.reject}</DialogTitle></DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="refund-reject-f1">{t.admin.refunds.colNote}</Label>
              <Input id="refund-reject-f1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button variant="destructive" type="submit" disabled={!!busy}>{t.admin.refunds.reject}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}