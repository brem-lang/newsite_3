import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function EditUserDialog({ user, actorIsSuper, open, onOpenChange, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ full_name: "", verification_status: "pending", verification_note: "", role: "user" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        verification_status: user.verification_status || "pending",
        verification_note: user.verification_note || "",
        role: user.role || "user"
      });
    }
  }, [user?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const save = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("updateUser", {
        user_id: user.id,
        full_name: form.full_name,
        verification_status: form.verification_status,
        verification_note: form.verification_note,
        role: form.role
      });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.users.saved);
      onOpenChange(null);
      onSaved?.();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2">{t.admin.users.editUser}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t.admin.users.name}</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t.admin.users.verification}</Label>
            <select
              value={form.verification_status}
              onChange={(e) => setForm({ ...form, verification_status: e.target.value })}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="pending">{t.admin.verification.status.pending}</option>
              <option value="verified">{t.admin.verification.status.verified}</option>
              <option value="rejected">{t.admin.verification.status.rejected}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">{t.admin.users.role}</Label>
            <select
              value={form.role}
              disabled={!actorIsSuper}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60">
              <option value="user">{t.admin.users.roleUser}</option>
              <option value="admin">{t.admin.users.roleAdmin}</option>
            </select>
            {!actorIsSuper && <p className="text-xs text-muted-foreground mt-1">{t.admin.users.roleSuperOnly}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
          <Button onClick={save} disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}