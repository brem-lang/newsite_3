import React, { useState } from "react";
import { Trophy, Mail, MessageCircle, CheckCircle2, Users, Bell, Phone, Copy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminPage, useAdminUserMap, useAdminUsersByIds, useAdminWinnerPaymentsByAuctions, winnerPaymentFor, adminPageQuery, firstPage, warmAdmin } from "@/lib/queries/admin";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import PaymentReminderButton from "@/components/admin/PaymentReminderButton";
import AdminPagination from "@/components/admin/AdminPagination";
import { adminKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sendEmail, sendWhatsApp, sendInApp } from "@/lib/messaging";
import AuctionBidsLog from "@/components/admin/AuctionBidsLog";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription
} from "@/components/ui/dialog";

const RESULTS = { where: { status: ["ended", "archived"] }, sort: "-created_date" };
const PAGE_SIZE = 10;

/** Route loader: the first page of results (paged in Postgres). */
export const prefetch = (qc) => {
  const params = firstPage(RESULTS, PAGE_SIZE);
  return warmAdmin(qc, adminPageQuery("Auction", adminKeys.resultsPage(params), params));
};

export default function AdminResults() {
  const { t } = useI18n();
  const table = useAdminPage("Auction", adminKeys.resultsPage, RESULTS, { initialPageSize: PAGE_SIZE });
  const { rows: ended, isPending: loading } = table;
  const load = () => table.refresh();
  // Full winner profiles (email, phone, WhatsApp) for just this page.
  const users = useAdminUsersByIds(ended.map((a) => a.winner_id), "*");
  const bidders = useAdminUserMap(); // shared name lookup for the bid logs
  // Payment records decide "paid" (same as Winner payments and Fulfilment).
  const payments = useAdminWinnerPaymentsByAuctions(ended.filter((a) => a.winner_id).map((a) => a.id));
  const qc = useQueryClient();
  const askConfirm = useConfirm();
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ subject: "", body: "" });


  // Same server action as Winner payments: updates the payment record and
  // the auction, releases the winner's hold and tells them.
  const markPaid = async (a, payment) => {
    if (!payment) return;
    const ok = await askConfirm({
      title: t.admin.results.markPaid,
      description: `${a.title} · ${t.common.currency}${Number(payment.amount || 0).toFixed(2)}`,
      confirmLabel: t.admin.results.markPaid,
    });
    if (!ok) return;
    try {
      const res = await base44.functions.invoke("markWinnerPaid", { payment_id: payment.id });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.results.markPaidDone);
      qc.invalidateQueries({ queryKey: adminKeys.winnerPaymentsAll() });
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const send = async (channel) => {
    if (!contact?.winner) return toast.error(t.admin.results.noWinner);
    setBusy(true);
    try {
      const subject = msg.subject || t.admin.results.title;
      if (channel === "inapp") {
        if (!msg.body.trim()) { toast.error(t.admin.results.message); return; }
        // Opens the auction when tapped in the winner's bell.
        await sendInApp(contact.winner, subject, msg.body.trim(), "info", { auction_id: contact.auction.id });
      } else if (channel === "email") {
        await sendEmail(contact.winner, subject, msg.body);
      } else {
        await sendWhatsApp(contact.winner, subject, msg.body);
      }
      await base44.entities.Auction.update(contact.auction.id, { winner_notified: true });
      toast.success(
        channel === "inapp" ? t.admin.results.sentInApp : channel === "email" ? t.admin.results.sent : t.admin.broadcast.waNote
      );
      setContact(null);
      setMsg({ subject: "", body: "" });
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><Trophy className="w-6 h-6 text-warning" />{t.admin.results.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.results.subtitle}</p>
      </div>

      {table.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.results.empty}</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {ended.map((a) => {
            const u = users[a.winner_id];
            const filled = a.subscriber_ids?.length || 0;
            const payment = a.winner_id ? winnerPaymentFor(payments, a.id, a.winner_id) : null;
            // Paid on the payment record, or (older wins) on the auction.
            const paid = payment ? payment.status === "paid" : !!a.paid;
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold truncate">{a.title}</h3>
                    <p className="text-xs text-muted-foreground">{t.admin.results.endedAt}: {a.end_time ? new Date(a.end_time).toLocaleDateString("en-GB") : "—"}</p>
                  </div>
                  {a.winner_id ? (
                    <span className={cn("shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full", paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                      {paid ? t.admin.results.paid : t.admin.results.unpaid}
                    </span>
                  ) : (
                    // No bids means no winner, so there is nothing to pay.
                    <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      {t.admin.results.noBids}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Field label={t.admin.results.winner} value={u ? (u.full_name || u.email) : t.admin.results.noWinner} />
                  <Field label={t.admin.results.winningBid} value={`${t.common.currency}${(a.current_price || 0).toFixed(2)}`} />
                  <Field label={t.admin.results.participants} value={filled} />
                </div>

                {/* Winner's contact details, so staff can reach them directly. */}
                {a.winner_id && u ? <WinnerContact user={u} t={t} /> : null}

                {a.winner_notified && <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t.admin.results.notified}</span>}

                <div className="flex flex-wrap gap-2 pt-1">
                  {a.winner_id && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => { setContact({ auction: a, winner: u }); setMsg({ subject: `${t.admin.results.title}: ${a.title}`, body: "" }); }}>
                      <Mail className="w-4 h-4" />{t.admin.results.contactWinner}
                    </Button>
                  )}
                  {a.winner_id && !paid && payment?.status === "pending" && (
                    <>
                      <PaymentReminderButton payment={payment} auction={a} />
                      <Button size="sm" className="gap-2" onClick={() => markPaid(a, payment)}><CheckCircle2 className="w-4 h-4" />{t.admin.results.markPaid}</Button>
                    </>
                  )}
                </div>
                </div>
                <AuctionBidsLog auction={a} users={bidders} />
              </div>

            );
          })}
        </div>
      )}
      {table.total > 0 && (
        <div className="rounded-2xl border border-border bg-card"><AdminPagination {...table.pagination} /></div>
      )}

      <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" />{t.admin.results.contactTitle}</DialogTitle>
            {contact?.winner && (
              <DialogDescription>{contact.winner.full_name || contact.winner.email}{contact.winner.phone ? ` · ${contact.winner.phone}` : ""}</DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4">
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t.admin.results.contactHint}</p>
            <div>
              <Label>{t.admin.results.subject}</Label>
              <Input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{t.admin.results.message}</Label>
              <Textarea value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={5} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button variant="outline" className="gap-2" onClick={() => send("whatsapp")} disabled={busy}><MessageCircle className="w-4 h-4" />{t.admin.broadcast.whatsapp}</Button>
            <Button variant="outline" className="gap-2" onClick={() => send("email")} disabled={busy}><Mail className="w-4 h-4" />{t.admin.results.send}</Button>
            <Button className="gap-2" onClick={() => send("inapp")} disabled={busy}><Bell className="w-4 h-4" />{busy ? t.admin.results.sending : t.admin.results.sendInApp}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WinnerContact({ user, t }) {
  const r = t.admin.results;
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(r.copied);
    } catch {
      toast.error("Error");
    }
  };
  const rows = [
    // Plain text (no tap-to-call); copy it with the button.
    { key: "phone", icon: Phone, label: r.phone, value: user.phone, href: null },
    { key: "email", icon: Mail, label: r.email, value: user.email, href: user.email ? `mailto:${user.email}` : null },
  ];
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-secondary/30 p-3 sm:grid-cols-2">
      {rows.map(({ key, icon: Icon, label, value, href }) => (
        <div key={key} className="flex min-w-0 items-center gap-2">
          <Icon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {value && href ? (
              <a href={href} dir="ltr" className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline">
                {value}
              </a>
            ) : value ? (
              <p dir="ltr" className="truncate text-sm font-semibold text-foreground select-all">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{r.notProvided}</p>
            )}
          </div>
          {value ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(value)} aria-label={`${r.copy} ${label}`}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}