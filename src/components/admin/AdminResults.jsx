import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Trophy, Mail, MessageCircle, CheckCircle2, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sendEmail, sendWhatsApp } from "@/lib/messaging";
import AuctionBidsLog from "@/components/admin/AuctionBidsLog";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

export default function AdminResults() {
  const { t } = useI18n();
  const [ended, setEnded] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ subject: "", body: "" });

  const load = useCallback(() => {
    base44.entities.Auction.filter({ status: "ended" }, "-created_date", 100).then(setEnded).finally(() => setLoading(false));
    base44.entities.User.list("", 1000).then((u) => { const m = {}; u.forEach((x) => { m[x.id] = x; }); setUsers(m); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (a) => {
    try {
      await base44.entities.Auction.update(a.id, { paid: true });
      toast.success(t.admin.results.markPaidDone);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const send = async (channel) => {
    if (!contact?.winner) return toast.error(t.admin.results.noWinner);
    setBusy(true);
    try {
      if (channel === "email") {
        await sendEmail(contact.winner, msg.subject || t.admin.results.title, msg.body);
      } else {
        await sendWhatsApp(contact.winner, msg.subject || t.admin.results.title, msg.body);
      }
      await base44.entities.Auction.update(contact.auction.id, { winner_notified: true });
      toast.success(channel === "email" ? t.admin.results.sent : t.admin.broadcast.waNote);
      setContact(null);
      setMsg({ subject: "", body: "" });
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><Trophy className="w-6 h-6 text-warning" />{t.admin.results.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.results.subtitle}</p>
      </div>

      {ended.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.results.empty}</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {ended.map((a) => {
            const u = users[a.winner_id];
            const filled = a.subscriber_ids?.length || 0;
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold truncate">{a.title}</h3>
                    <p className="text-xs text-muted-foreground">{t.admin.results.endedAt}: {a.end_time ? new Date(a.end_time).toLocaleDateString("en-GB") : "—"}</p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full", a.paid ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {a.paid ? t.admin.results.paid : t.admin.results.unpaid}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Field label={t.admin.results.winner} value={u ? (u.full_name || u.email) : t.admin.results.noWinner} />
                  <Field label={t.admin.results.winningBid} value={`${t.common.currency}${(a.current_price || 0).toFixed(2)}`} />
                  <Field label={t.admin.results.participants} value={filled} />
                </div>

                {a.winner_notified && <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5" />{t.admin.results.notified}</span>}

                <div className="flex flex-wrap gap-2 pt-1">
                  {a.winner_id && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => { setContact({ auction: a, winner: u }); setMsg({ subject: `${t.admin.results.title}: ${a.title}`, body: "" }); }}>
                      <Mail className="w-4 h-4" />{t.admin.results.contactWinner}
                    </Button>
                  )}
                  {!a.paid && <Button size="sm" className="gap-2" onClick={() => markPaid(a)}><CheckCircle2 className="w-4 h-4" />{t.admin.results.markPaid}</Button>}
                </div>
                </div>
                <AuctionBidsLog auction={a} users={users} />
              </div>

            );
          })}
        </div>
      )}

      <Dialog open={!!contact} onOpenChange={(o) => !o && setContact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" />{t.admin.results.contactTitle}</DialogTitle></DialogHeader>
          {contact?.winner && (
            <p className="text-sm text-muted-foreground">{contact.winner.full_name || contact.winner.email}{contact.winner.phone ? ` · ${contact.winner.phone}` : ""}</p>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t.admin.results.subject}</Label>
              <Input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t.admin.results.message}</Label>
              <Textarea value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} rows={5} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button variant="outline" className="gap-2" onClick={() => send("whatsapp")} disabled={busy}><MessageCircle className="w-4 h-4" />{t.admin.broadcast.whatsapp}</Button>
            <Button className="gap-2" onClick={() => send("email")} disabled={busy}><Mail className="w-4 h-4" />{busy ? t.admin.results.sending : t.admin.results.send}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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