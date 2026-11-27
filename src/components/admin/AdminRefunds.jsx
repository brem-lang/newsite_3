import React, { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminPage, useAdminUsersByIds, adminPageQuery, firstPage, toMap, warmAdmin, warmLabels, useLabelMap, isLabelLoading, ADMIN_STALE } from "@/lib/queries/admin";
import LabelPlaceholder from "@/components/admin/LabelPlaceholder";
import { adminKeys } from "@/lib/queries/keys";
import AdminPagination from "@/components/admin/AdminPagination";
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

const PENDING = { sort: "-created_date", where: { status: "pending" } };
const RESOLVED = { sort: "-created_date", notIn: { status: ["pending"] } };
const pendingKey = (params) => adminKeys.refundsPage("pending", params);
const resolvedKey = (params) => adminKeys.refundsPage("resolved", params);

/** Original transactions for just the refund requests on screen (for the amount column). */
const txnsByIdsQuery = (ids) => {
  const list = [...new Set(ids.filter(Boolean))].sort();
  return {
    queryKey: adminKeys.refundTxnsByIds(list),
    queryFn: async () => toMap(await base44.entities.WalletTransaction.filterFields("id, amount", { id: list }, "", list.length)),
    enabled: list.length > 0,
    staleTime: ADMIN_STALE,
    placeholderData: keepPreviousData,
  };
};

/** Route loader: the first page of each list (paged in Postgres), with names and amounts. */
export const prefetch = async (qc) => {
  const p1 = firstPage(PENDING);
  const p2 = firstPage(RESOLVED);
  const [a, b] = await warmAdmin(qc, adminPageQuery("RefundRequest", pendingKey(p1), p1), adminPageQuery("RefundRequest", resolvedKey(p2), p2));
  const onScreen = [...(a?.rows || []), ...(b?.rows || [])];
  await warmLabels(qc, onScreen, {
    users: ["user_id"],
    extra: [txnsByIdsQuery(onScreen.map((r) => r.original_transaction_id))],
  });
};

export default function AdminRefunds() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const pendingTable = useAdminPage("RefundRequest", pendingKey, PENDING);
  const resolvedTable = useAdminPage("RefundRequest", resolvedKey, RESOLVED);
  const pending = pendingTable.rows;
  const resolved = resolvedTable.rows;
  const onScreen = [...pending, ...resolved];
  const txns = useLabelMap(useQuery(txnsByIdsQuery(onScreen.map((r) => r.original_transaction_id))));
  const users = useAdminUsersByIds(onScreen.map((r) => r.user_id));
  const loading = pendingTable.isPending || resolvedTable.isPending;
  // A decision moves a request from one list to the other: refresh both.
  const load = () => qc.invalidateQueries({ queryKey: adminKeys.refundsAll() });
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


  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><RotateCcw className="w-6 h-6" />{t.admin.refunds.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.refunds.subtitle}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border"><h3 className="font-heading text-lg font-semibold">{t.admin.refunds.title}</h3></div>
        {pendingTable.total === 0 ? (
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
                      <td className="px-4 py-3 font-medium">{u ? (u.full_name || u.email) : isLabelLoading(users, r.user_id) ? <LabelPlaceholder /> : `…${r.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3">{isLabelLoading(txns, r.original_transaction_id) ? <LabelPlaceholder className="w-14" /> : `${t.common.currency}${Math.abs(txn?.amount || 0).toFixed(2)}`}</td>
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
        {pendingTable.total > 0 && <AdminPagination {...pendingTable.pagination} />}
      </div>

      {resolvedTable.total > 0 && (
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
                      <td className="px-4 py-3 font-medium">{u ? (u.full_name || u.email) : isLabelLoading(users, r.user_id) ? <LabelPlaceholder /> : `…${r.user_id?.slice(-4)}`}</td>
                      <td className="px-4 py-3">{isLabelLoading(txns, r.original_transaction_id) ? <LabelPlaceholder className="w-14" /> : `${t.common.currency}${Math.abs(txn?.amount || 0).toFixed(2)}`}</td>
                      <td className="px-4 py-3"><span className={cn("inline-block text-xs font-semibold rounded-full px-2.5 py-1", STATUS_CLS[r.status])}>{t.refund.status[r.status]}</span></td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{r.admin_note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination {...resolvedTable.pagination} />
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