import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Truck, MapPin, Loader2, CreditCard, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminPage, useAdminUsersByIds, useAdminAuctionsByIds, useAdminWinnerPaymentsByAuctions, winnerPaymentFor, winnerPaymentsByAuctionsQuery, adminPageQuery, adminSection, firstPage, warmAdmin, warmLabels, isLabelLoading, isLookupLoading } from "@/lib/queries/admin";
import LabelPlaceholder from "@/components/admin/LabelPlaceholder";
import PaymentReminderButton from "@/components/admin/PaymentReminderButton";
import { adminKeys } from "@/lib/queries/keys";
import AdminPagination from "@/components/admin/AdminPagination";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SHIPPING = ["pending", "shipped", "delivered", "confirmed"];
const PICKUP = ["pending", "ready", "collected", "confirmed"];
const STATUS_CLS = {
  pending: "bg-warning/15 text-warning", shipped: "bg-info/15 text-info", ready: "bg-info/15 text-info",
  delivered: "bg-info/15 text-info", collected: "bg-info/15 text-info", confirmed: "bg-success/15 text-success"
};

const ORDERS = { sort: "-created_date" };

/** The winner's payment record for an order. */
const paymentFor = (payments, o) => winnerPaymentFor(payments, o.auction_id, o.winner_id);

/** Stat cards: one exact count per stage, straight from Postgres. */
const STAGES = {
  pending: ["pending"],
  inTransit: ["shipped", "ready"],
  delivered: ["delivered", "collected"],
  done: ["confirmed"],
};
const loadCounts = async () => {
  const entries = await Promise.all(
    Object.entries(STAGES).map(async ([k, statuses]) => [k, await base44.entities.Fulfilment.count({ where: { status: statuses } })]),
  );
  return Object.fromEntries(entries);
};
const countsQuery = () => adminSection(adminKeys.fulfilmentCounts(), loadCounts);

/** Route loader: the stage counts, the first page of orders and its names / payment records. */
export const prefetch = async (qc) => {
  const params = firstPage(ORDERS);
  const [, first] = await warmAdmin(qc, countsQuery(), adminPageQuery("Fulfilment", adminKeys.fulfilmentPage(params), params));
  const orders = first?.rows || [];
  await warmLabels(qc, orders, {
    users: ["winner_id"],
    auctions: ["auction_id"],
    extra: [winnerPaymentsByAuctionsQuery(orders.map((o) => o.auction_id))],
  });
};

export default function AdminFulfilment() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const table = useAdminPage("Fulfilment", adminKeys.fulfilmentPage, ORDERS);
  const orders = table.rows;
  const { data: counts } = useQuery(countsQuery());
  // Labels for just the orders on this page.
  const auctions = useAdminAuctionsByIds(orders.map((o) => o.auction_id));
  const users = useAdminUsersByIds(orders.map((o) => o.winner_id));
  const payments = useAdminWinnerPaymentsByAuctions(orders.map((o) => o.auction_id));
  const [payDialog, setPayDialog] = useState(null);
  const [payForm, setPayForm] = useState({ reference: "", note: "" });
  const loading = table.isPending;
  const load = () => {
    qc.invalidateQueries({ queryKey: adminKeys.fulfilmentAll() });
    qc.invalidateQueries({ queryKey: adminKeys.auctionsByIds() }); // "paid" flag
    qc.invalidateQueries({ queryKey: adminKeys.winnerPaymentsAll() });
  };
  const [advance, setAdvance] = useState(null);
  const [form, setForm] = useState({ carrier: "", tracking_number: "", notes: "" });
  const [busy, setBusy] = useState(false);


  const nextStatus = (o) => {
    const steps = o.method === "pickup" ? PICKUP : SHIPPING;
    const i = steps.indexOf(o.status);
    return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
  };

  const openAdvance = (o) => {
    setAdvance(o);
    setForm({ carrier: o.carrier || "", tracking_number: o.tracking_number || "", notes: o.notes || "" });
  };

  const confirmAdvance = async () => {
    if (!advance) return;
    setBusy(true);
    try {
      const ns = nextStatus(advance);
      const res = await base44.functions.invoke("updateFulfilment", {
        fulfilment_id: advance.id,
        status: ns,
        carrier: form.carrier,
        tracking_number: form.tracking_number,
        notes: form.notes
      });
      if (res.data?.error) {
        toast.error(res.data.error === "payment_required" ? t.admin.fulfilment.paymentRequired : res.data.error);
        return;
      }
      toast.success(t.admin.fulfilment.saved);
      setAdvance(null);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  // Same action as Admin → Winner payments, so both screens always agree
  // (it also releases the winner's escrow hold and tells them).
  const openMarkPaid = (payment) => {
    setPayDialog(payment);
    setPayForm({ reference: "", note: "" });
  };
  const confirmPaid = async () => {
    if (!payDialog) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("markWinnerPaid", {
        payment_id: payDialog.id,
        reference: payForm.reference,
        note: payForm.note,
      });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.fulfilment.paidDone);
      setPayDialog(null);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  const stats = counts || { pending: 0, inTransit: 0, delivered: 0, done: 0 };
  const cards = [
    { label: t.admin.fulfilment.stats.pending, value: stats.pending },
    { label: t.admin.fulfilment.stats.inTransit, value: stats.inTransit },
    { label: t.admin.fulfilment.stats.delivered, value: stats.delivered },
    { label: t.admin.fulfilment.stats.done, value: stats.done }
  ];

  return (
    <div className="space-y-6 admin-fill">
      <div className="admin-page-header">
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><PackageCheck className="w-6 h-6" />{t.admin.fulfilment.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.fulfilment.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-heading text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className={cn("admin-table-card rounded-2xl border border-border bg-card overflow-hidden", table.isPlaceholderData && "opacity-60")}>
        <div className="admin-table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colAuction}</th>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colWinner}</th>
                <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.fulfilment.colMethod}</th>
                <th className="text-start font-medium px-4 py-3 hidden md:table-cell">{t.admin.fulfilment.colAddress}</th>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colStatus}</th>
                <th className="text-end font-medium px-4 py-3">{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">{t.admin.fulfilment.empty}</td></tr>
              ) : orders.map((o) => {
                const a = auctions[o.auction_id];
                const u = users[o.winner_id];
                const ns = nextStatus(o);
                const payment = paymentFor(payments, o);
                // Paid on the payment record, or (older wins) on the auction.
                const paid = payment?.status === "paid" || (!!a?.paid && !payment);
                // Until this page's payment records (and auction "paid" flag) arrive, don't guess.
                const payLoading = isLookupLoading(payments) || isLabelLoading(auctions, o.auction_id);
                return (
                  <tr key={o.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{a?.title || (isLabelLoading(auctions, o.auction_id) ? <LabelPlaceholder /> : "—")}</td>
                    <td className="px-4 py-3">{u ? (u.full_name || u.email) : isLabelLoading(users, o.winner_id) ? <LabelPlaceholder /> : `…${o.winner_id?.slice(-4)}`}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{o.method === "shipping" ? t.fulfilment.methodShip : t.fulfilment.methodPickup}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {o.method === "shipping" ? (
                        <span className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />{[o.address_name, o.address_line1, o.address_city, o.address_country].filter(Boolean).join(", ")}</span>
                      ) : (
                        <span>{o.pickup_notes || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("inline-block text-xs font-semibold rounded-full px-2.5 py-1", STATUS_CLS[o.status])}>{t.fulfilment.status[o.status]}</span>
                        {payLoading ? (
                          <LabelPlaceholder className="w-16" />
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5",
                              paid ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
                            )}
                          >
                            <CreditCard className="w-3 h-3" aria-hidden="true" />
                            {paid ? t.admin.fulfilment.paid : t.admin.fulfilment.awaitingPayment}
                          </span>
                        )}
                      </div>
                      {o.carrier && <span className="block text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Truck className="w-3 h-3" />{o.carrier} {o.tracking_number}</span>}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {payLoading ? <LabelPlaceholder className="w-24 h-7" /> : <>
                        {!paid && payment?.status === "pending" && (
                          <>
                            <PaymentReminderButton payment={payment} auction={a} />
                            <Button size="sm" variant="outline" onClick={() => openMarkPaid(payment)}>{t.admin.fulfilment.markPaid}</Button>
                          </>
                        )}
                        {!paid && !payment && (
                          <span className="text-[11px] text-muted-foreground">{t.admin.fulfilment.noPaymentRecord}</span>
                        )}
                        {ns && (paid ? (
                          <Button size="sm" onClick={() => openAdvance(o)}>{t.admin.fulfilment.advance.replace("{status}", t.fulfilment.status[ns])}</Button>
                        ) : (
                          <Button size="sm" disabled title={t.admin.fulfilment.paymentRequired} className="gap-1">
                            <Lock className="w-3.5 h-3.5" aria-hidden="true" /> {t.admin.fulfilment.waitingForPayment}
                          </Button>
                        ))}
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminPagination {...table.pagination} />
      </div>

      <Dialog open={!!advance} onOpenChange={(o) => !o && setAdvance(null)}>
        <DialogContent size="sm">
          <DialogForm onSubmit={(e) => { e.preventDefault(); confirmAdvance(); }}>
            <DialogHeader><DialogTitle>{t.admin.fulfilment.advance.replace("{status}", advance ? t.fulfilment.status[nextStatus(advance)] || "" : "")}</DialogTitle></DialogHeader>
            {advance && advance.method === "shipping" && (
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="fulfilment-f1">{t.admin.fulfilment.carrierPrompt}</Label>
                  <Input id="fulfilment-f1" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="fulfilment-f2">{t.admin.fulfilment.trackingPrompt}</Label>
                  <Input id="fulfilment-f2" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent size="sm">
          <DialogForm onSubmit={(e) => { e.preventDefault(); confirmPaid(); }}>
            <DialogHeader><DialogTitle>{t.admin.fulfilment.markPaidTitle}</DialogTitle></DialogHeader>
            {payDialog && (
              <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  {t.common.currency}{Number(payDialog.amount || 0).toFixed(2)}
                </p>
                <div>
                  <Label htmlFor="fulfilment-pay-ref">{t.admin.fulfilment.paymentReference}</Label>
                  <Input id="fulfilment-pay-ref" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="fulfilment-pay-note">{t.admin.fulfilment.paymentNote}</Label>
                  <Input id="fulfilment-pay-note" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.saving : t.admin.fulfilment.markPaid}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}