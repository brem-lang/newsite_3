import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt, Copy, CheckCircle2, XCircle, Clock, RefreshCw, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm
} from "@/components/ui/dialog";

const STATUSES = ["pending", "paid", "void"];

/**
 * Manual winner payments: every win is recorded unpaid with a payment link.
 * Admins send the link, confirm the payment by hand, or void the win so the
 * runner-up is promoted.
 */
export default function AdminWinnerPayments() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [auctions, setAuctions] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [payDialog, setPayDialog] = useState(null);
  const [form, setForm] = useState({ reference: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, list, people] = await Promise.all([
        base44.functions.invoke("listWinnerPayments", {}),
        base44.entities.Auction.list("-created_date", 500),
        base44.entities.User.list("", 1000),
      ]);
      setRows(res.data?.payments || []);
      const am = {};
      (list || []).forEach((a) => { am[a.id] = a; });
      setAuctions(am);
      const um = {};
      (people || []).forEach((u) => { um[u.id] = u; });
      setUsers(um);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      const u = users[r.user_id];
      const hay = [auctions[r.auction_id]?.title, u?.full_name, u?.email, r.token, r.paid_reference]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, status, q, auctions, users]);

  const totals = useMemo(() => {
    const sum = (s) => rows.filter((r) => r.status === s).reduce((n, r) => n + Number(r.amount || 0), 0);
    return { pending: sum("pending"), paid: sum("paid"), count: rows.length };
  }, [rows]);

  const linkFor = (r) => `${window.location.origin}/pay/${r.token}`;

  const copyLink = async (r) => {
    try {
      await navigator.clipboard.writeText(linkFor(r));
      toast.success(t.admin.winnerPayments?.linkCopied || "Payment link copied");
    } catch {
      toast.error(linkFor(r));
    }
  };

  const confirmPaid = async () => {
    if (!payDialog) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("markWinnerPaid", {
        payment_id: payDialog.id,
        reference: form.reference,
        note: form.note,
      });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.winnerPayments?.markedPaid || "Marked as paid");
      setPayDialog(null);
      setForm({ reference: "", note: "" });
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const voidWin = async (r) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("voidWin", { payment_id: r.id });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(
        res.data?.promoted
          ? (t.admin.winnerPayments?.promoted || "Runner-up promoted")
          : (t.admin.winnerPayments?.noRunnerUp || "No runner-up left"),
      );
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            {t.admin.winnerPayments?.title || "Winner payments"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t.admin.winnerPayments?.subtitle ||
              "Winners are never charged automatically. Send the payment link, then confirm the payment here."}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {t.admin.refresh || "Refresh"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t.admin.winnerPayments?.awaiting || "Awaiting payment"} value={`${t.common.currency}${totals.pending.toFixed(2)}`} tone="amber" />
        <Stat label={t.admin.winnerPayments?.collected || "Collected"} value={`${t.common.currency}${totals.paid.toFixed(2)}`} tone="emerald" />
        <Stat label={t.admin.winnerPayments?.wins || "Total wins"} value={totals.count} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.admin.search || "Search"} className="ps-9" />
        </div>
        {["all", ...STATUSES].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s === "all" ? (t.admin.all || "All") : s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 grid place-items-center">
          <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {t.admin.winnerPayments?.empty || "No winner payments yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const u = users[r.user_id];
            const a = auctions[r.auction_id];
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{a?.title || r.auction_id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u?.full_name || u?.email || r.user_id} · {t.admin.winnerPayments?.round || "Round"} {r.round}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-heading text-lg font-bold">{t.common.currency}{Number(r.amount || 0).toFixed(2)}</p>
                    <StatusBadge status={r.status} t={t} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => copyLink(r)}>
                    <Copy className="w-4 h-4" />{t.admin.winnerPayments?.copyLink || "Copy payment link"}
                  </Button>
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" className="gap-2" disabled={busy} onClick={() => { setPayDialog(r); setForm({ reference: "", note: "" }); }}>
                        <CheckCircle2 className="w-4 h-4" />{t.admin.winnerPayments?.markPaid || "Mark as paid"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2 text-destructive" disabled={busy} onClick={() => voidWin(r)}>
                        <XCircle className="w-4 h-4" />{t.admin.winnerPayments?.voidWin || "Void & promote runner-up"}
                      </Button>
                    </>
                  )}
                </div>

                {r.status === "paid" && (r.paid_reference || r.paid_at) && (
                  <p className="text-xs text-muted-foreground">
                    {r.paid_at ? new Date(r.paid_at).toLocaleString("en-GB") : ""}
                    {r.paid_reference ? ` · ${r.paid_reference}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); confirmPaid(); }}>
            <DialogHeader>
              <DialogTitle>{t.admin.winnerPayments?.markPaid || "Mark as paid"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs" htmlFor="winner-pay-f1">{t.admin.winnerPayments?.reference || "Reference"}</Label>
                <Input id="winner-pay-f1" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="winner-pay-f2">{t.admin.winnerPayments?.note || "Note"}</Label>
                <Input id="winner-pay-f2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{t.admin.save || "Save"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(
        "font-heading text-xl font-bold mt-1",
        tone === "amber" && "text-warning",
        tone === "emerald" && "text-success",
      )}>{value}</p>
    </div>
  );
}

function StatusBadge({ status, t }) {
  const map = {
    pending: { cls: "bg-warning/15 text-warning", icon: Clock, label: t.admin.winnerPayments?.pending || "Awaiting payment" },
    paid: { cls: "bg-success/15 text-success", icon: CheckCircle2, label: t.admin.winnerPayments?.paid || "Paid" },
    void: { cls: "bg-muted text-muted-foreground", icon: XCircle, label: t.admin.winnerPayments?.voided || "Voided" },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1", s.cls)}>
      <Icon className="w-3 h-3" />{s.label}
    </span>
  );
}
