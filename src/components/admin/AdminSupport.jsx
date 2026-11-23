import React, { useState } from "react";
import { LifeBuoy, Send, RotateCcw, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDiscardGuard } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";


const CAT_LABEL = (t, c) => ({
  general: t.admin.support.catGeneral, dispute: t.admin.support.catDispute,
  payment: t.admin.support.catPayment, technical: t.admin.support.catTechnical, other: t.admin.support.catOther
}[c] || c);
const PRIO_LABEL = (t, p) => ({ low: t.admin.support.priorityLow, normal: t.admin.support.priorityNormal, high: t.admin.support.priorityHigh }[p] || p);
const STATUS_LABEL = (t, s) => ({ open: t.admin.support.statusOpen, pending: t.admin.support.statusPending, resolved: t.admin.support.statusResolved, closed: t.admin.support.statusClosed }[s] || s);

const PRIO_CLS = { high: "bg-destructive/10 text-destructive", normal: "bg-warning/10 text-warning", low: "bg-surface text-muted-foreground" };
const STATUS_CLS = { open: "bg-success/10 text-success", pending: "bg-warning/10 text-warning", resolved: "bg-info/10 text-info", closed: "bg-surface text-muted-foreground" };

const NONE = [];

const loadSection = async () => (await base44.entities.SupportTicket.list("-created_date", 200)) || [];

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["support"], loadSection));

export default function AdminSupport() {
  const { t } = useI18n();
  const { data: items = NONE, isPending: loading, refresh: load } = useAdminData(["support"], loadSection);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);
  const replyGuard = useDiscardGuard(!!active);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);


  const filtered = items.filter((it) => filter === "all" || it.status === filter);

  const openTicket = (it) => { setActive(it); setReply(it.staff_reply || ""); };

  const updateTicket = async (status, withReply) => {
    if (!active) return;
    setSaving(true);
    try {
      const payload = { status };
      if (withReply) {
        payload.staff_reply = reply;
        payload.replied_at = new Date().toISOString();
      }
      await base44.entities.SupportTicket.update(active.id, payload);
      toast.success(status === "resolved" ? t.admin.support.resolved : status === "closed" ? t.admin.support.closed : t.admin.saved);
      setActive(null);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    all: items.length,
    open: items.filter((i) => i.status === "open").length,
    pending: items.filter((i) => i.status === "pending").length,
    resolved: items.filter((i) => i.status === "resolved").length
  };

  const FilterChip = ({ id, label }) => (
    <button
      onClick={() => setFilter(id)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition",
        filter === id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary"
      )}
    >
      {label} <span className="opacity-60 ms-1">{counts[id]}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.support.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.support.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip id="all" label={t.admin.support.filterAll} />
        <FilterChip id="open" label={t.admin.support.filterOpen} />
        <FilterChip id="pending" label={t.admin.support.filterPending} />
        <FilterChip id="resolved" label={t.admin.support.filterResolved} />
      </div>

      {loading ? null : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <LifeBuoy className="w-8 h-8 mx-auto mb-3 opacity-30" />
          {t.admin.support.noTickets}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <button
              key={it.id}
              onClick={() => openTicket(it)}
              className="w-full text-start rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", PRIO_CLS[it.priority] || "bg-muted-foreground/40")} />
                <div className="min-w-0">
                  <p className="font-semibold truncate flex items-center gap-2">
                    {it.subject}
                    {it.auction_id && <Badge variant="outline" className="text-[10px]">{t.admin.support.catDispute}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {it.user_name || it.user_email || "—"} · {CAT_LABEL(t, it.category)} · {new Date(it.created_date).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge className={cn("text-[10px]", STATUS_CLS[it.status] || "bg-surface")}>{STATUS_LABEL(t, it.status)}</Badge>
                <Badge variant="outline" className={cn("text-[10px]", PRIO_CLS[it.priority])}>{PRIO_LABEL(t, it.priority)}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={replyGuard.guard((o) => !o && setActive(null))}>
        <DialogContent size="lg" onChange={replyGuard.markDirty}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-primary" /> {active?.subject}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{CAT_LABEL(t, active.category)}</Badge>
                <Badge variant="outline" className={PRIO_CLS[active.priority]}>{PRIO_LABEL(t, active.priority)}</Badge>
                <Badge className={cn(STATUS_CLS[active.status])}>{STATUS_LABEL(t, active.status)}</Badge>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">{active.user_name || active.user_email || "Member"} · {new Date(active.created_date).toLocaleString("en-GB")}</p>
                <p className="text-sm whitespace-pre-line">{active.body}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t.admin.support.reply}</Label>
                <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => updateTicket("pending", true)} disabled={saving} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> {t.admin.support.setPending}
            </Button>
            <Button variant="ghost" onClick={() => updateTicket("closed", false)} disabled={saving}>
              {t.admin.support.close}
            </Button>
            <Button onClick={() => updateTicket("resolved", true)} disabled={saving || !reply.trim()} className="gap-1.5">
              {saving ? t.admin.saving : <><Send className="w-4 h-4" /> {t.admin.support.sendReply}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}