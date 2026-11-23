import React, { useState } from "react";
import { Mail, MessageCircle, Bell, Send, Users } from "lucide-react";
import { useAdminUsers, useAdminAuctions, adminLookups, warmAdmin } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sendEmail, sendWhatsApp, sendInApp } from "@/lib/messaging";
import SelectField from "@/components/ui/select-field";

/** Route loader: the audience lists (users, auctions). */
export const prefetch = (qc) => warmAdmin(qc, adminLookups.users(), adminLookups.auctions());

export default function AdminBroadcast() {
  const { t } = useI18n();
  // Shared, cached lookups (the same reads other admin panels use).
  const { data: users } = useAdminUsers();
  const { data: auctions } = useAdminAuctions();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ channel: "inapp", segment: "all", auctionId: "", subject: "", body: "" });


  // Only auctions that are still running can be messaged; closed ones are hidden.
  const activeAuctions = auctions.filter(
    (a) => !["ended", "voided", "voiding"].includes(a.status)
  );

  const recipients = (() => {
    if (form.segment === "all") return users;
    if (form.segment === "winners") {
      const ids = new Set(auctions.filter((a) => a.winner_id).map((a) => a.winner_id));
      return users.filter((u) => ids.has(u.id));
    }
    if (form.segment === "auction" && form.auctionId) {
      const a = auctions.find((x) => x.id === form.auctionId);
      const ids = new Set(a?.subscriber_ids || []);
      return users.filter((u) => ids.has(u.id));
    }
    return [];
  })();

  const ChannelIcon = { inapp: Bell, email: Mail, whatsapp: MessageCircle }[form.channel];

  const send = async () => {
    if (recipients.length === 0) return toast.error(t.admin.broadcast.noRecipients);
    if (!form.subject || !form.body) return;
    setBusy(true);
    let sent = 0;
    for (const u of recipients) {
      try {
        if (form.channel === "email") await sendEmail(u, form.subject, form.body);
        else if (form.channel === "inapp") await sendInApp(u, form.subject, form.body, "announcement");
        else await sendWhatsApp(u, form.subject, form.body);
        sent++;
      } catch (e) {
        // continue
      }
    }
    setBusy(false);
    if (form.channel === "whatsapp") toast.success(t.admin.broadcast.waNote);
    else toast.success(t.admin.broadcast.sent.replace("{count}", sent));
    setForm({ ...form, subject: "", body: "" });
  };

  const channels = [
    { id: "inapp", label: t.admin.broadcast.inapp, icon: Bell },
    { id: "email", label: t.admin.broadcast.email, icon: Mail },
    { id: "whatsapp", label: t.admin.broadcast.whatsapp, icon: MessageCircle }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><Send className="w-6 h-6" />{t.admin.broadcast.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.broadcast.subtitle}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <Label className="text-xs">{t.admin.broadcast.channel}</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {channels.map((c) => (
                  <button key={c.id} onClick={() => setForm({ ...form, channel: c.id })}
                    className={cn("flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium border transition-colors",
                      form.channel === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary/60")}>
                    <c.icon className="w-4 h-4" />{c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">{t.admin.broadcast.recipients}</Label>
              <SelectField value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}
                className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">{t.admin.broadcast.all}</option>
                <option value="winners">{t.admin.broadcast.winners}</option>
                <option value="auction">{t.admin.broadcast.auction}</option>
              </SelectField>
            </div>

            {form.segment === "auction" && (
              <div>
                <Label className="text-xs">{t.admin.broadcast.selectAuction}</Label>
                <SelectField value={form.auctionId} onChange={(e) => setForm({ ...form, auctionId: e.target.value })}
                  className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option>
                  {activeAuctions.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </SelectField>
              </div>
            )}

            <div>
              <Label className="text-xs">{t.admin.broadcast.subject}</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">{t.admin.broadcast.body}</Label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6}
                className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>

            {form.channel === "whatsapp" && (
              <p className="text-xs text-warning bg-warning/10 border border-warning/25 rounded-lg px-3 py-2">{t.admin.broadcast.waNote}</p>
            )}

            <Button onClick={send} disabled={busy} className="w-full gap-2">
              <ChannelIcon className="w-4 h-4" />{busy ? t.admin.broadcast.sending : t.admin.broadcast.send}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" />{t.admin.broadcast.recipients}</h3>
          <p className="font-display text-3xl font-bold">{recipients.length}</p>
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {recipients.slice(0, 50).map((u) => (
              <div key={u.id} className="py-2 text-sm">
                <p className="font-medium truncate">{u.full_name || u.email}</p>
                {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}