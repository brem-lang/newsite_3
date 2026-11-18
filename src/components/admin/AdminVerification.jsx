import React, { useEffect, useState, useCallback } from "react";
import { UserCheck, ShieldCheck, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logAdminAction } from "@/lib/adminAudit";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CLS = {
  pending: "bg-warning/15 text-warning",
  verified: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive"
};

export default function AdminVerification() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    base44.entities.User.list("-created_date", 500).then(setUsers).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const verify = async (u) => {
    setBusy(u.id + "v");
    try {
      const res = await base44.functions.invoke("resolveVerification", { user_id: u.id, decision: "verify" });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction("user.verify", { targetType: "profiles", targetId: u.id, details: u.email });
      toast.success(t.admin.verification.approved);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy("");
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id + "r");
    try {
      const res = await base44.functions.invoke("resolveVerification", { user_id: rejecting.id, decision: "reject", note });
      if (res.data?.error) { toast.error(res.data.error); return; }
      logAdminAction("user.verify_reject", { targetType: "profiles", targetId: rejecting.id, details: note });
      toast.success(t.admin.verification.rejected);
      setRejecting(null); setNote("");
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy("");
    }
  };

  if (loading) return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const members = users.filter((u) => u.role !== "admin");
  const queue = members.filter((u) => u.verification_status !== "verified" && u.verification_status !== "rejected");
  const reviewed = members.filter((u) => u.verification_status === "verified" || u.verification_status === "rejected");
  const stats = {
    pending: queue.length,
    verified: members.filter((u) => u.verification_status === "verified").length,
    rejected: members.filter((u) => u.verification_status === "rejected").length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><UserCheck className="w-6 h-6" />{t.admin.verification.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.verification.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t.admin.verification.status.pending} value={stats.pending} cls="text-warning" />
        <Stat label={t.admin.verification.status.verified} value={stats.verified} cls="text-success" />
        <Stat label={t.admin.verification.status.rejected} value={stats.rejected} cls="text-destructive" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-warning" />
          <h3 className="font-heading text-lg font-semibold">{t.admin.verification.title}</h3>
        </div>
        {queue.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t.admin.verification.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-4 py-3">{t.admin.verification.colName}</th>
                  <th className="text-start font-medium px-4 py-3">{t.admin.verification.colEmail}</th>
                  <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.verification.colDate}</th>
                  <th className="text-end font-medium px-4 py-3">{t.admin.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{new Date(u.created_date).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => verify(u)} className="gap-1"><ShieldCheck className="w-3.5 h-3.5" />{t.admin.verification.approve}</Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setRejecting(u); setNote(""); }} className="gap-1"><X className="w-3.5 h-3.5" />{t.admin.verification.reject}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold text-muted-foreground">{t.admin.verification.recent}</h3>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="text-start font-medium px-4 py-3">{t.admin.verification.colName}</th>
                    <th className="text-start font-medium px-4 py-3">{t.admin.verification.colEmail}</th>
                    <th className="text-start font-medium px-4 py-3">{t.admin.verification.colStatus}</th>
                    <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.verification.note}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reviewed.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3"><span className={cn("inline-block text-xs font-semibold rounded-full px-2.5 py-1", STATUS_CLS[u.verification_status])}>{t.admin.verification.status[u.verification_status]}</span></td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{u.verification_note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogForm onSubmit={(e) => { e.preventDefault(); confirmReject(); }}>
            <DialogHeader><DialogTitle>{t.admin.verification.reject}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="verify-reject-f1">{t.admin.verification.note}</Label>
              <Input id="verify-reject-f1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button variant="destructive" type="submit" disabled={!!busy}>{t.admin.verification.reject}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, cls }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-heading text-2xl font-bold mt-1", cls)}>{value}</p>
    </div>
  );
}