import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import SelectField from "@/components/ui/select-field";
import { KeyRound } from "lucide-react";
import SetPasswordDialog from "@/components/admin/SetPasswordDialog";

export default function EditUserDialog({ user, actorIsSuper, open, onOpenChange, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ full_name: "", verification_status: "pending", verification_note: "", role: "user" });
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

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
        <DialogForm onSubmit={(e) => { e.preventDefault(); save(); }}>
          <DialogHeader><DialogTitle className="flex items-center gap-2">{t.admin.users.editUser}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="edit-user-f1">{t.admin.users.name}</Label>
              <Input id="edit-user-f1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-user-f2">{t.admin.users.verification}</Label>
              <SelectField id="edit-user-f2"
                value={form.verification_status}
                onChange={(e) => setForm({ ...form, verification_status: e.target.value })}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="pending">{t.admin.verification.status.pending}</option>
                <option value="verified">{t.admin.verification.status.verified}</option>
                <option value="rejected">{t.admin.verification.status.rejected}</option>
              </SelectField>
            </div>
            <div>
              <Label htmlFor="edit-user-f3">{t.admin.users.role}</Label>
              <SelectField id="edit-user-f3"
                value={form.role}
                disabled={!actorIsSuper}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60">
                <option value="user">{t.admin.users.roleUser}</option>
                <option value="admin">{t.admin.users.roleAdmin}</option>
              </SelectField>
              {!actorIsSuper && <p className="text-xs text-muted-foreground mt-1">{t.admin.users.roleSuperOnly}</p>}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {/* Staff passwords: super admins only (the server checks too). */}
            {actorIsSuper || user.role !== "admin" ? (
              <Button type="button" variant="ghost" onClick={() => setPwOpen(true)} className="gap-1.5 sm:me-auto">
                <KeyRound className="w-4 h-4" /> Set password
              </Button>
            ) : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button type="submit" disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
            </div>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
      <SetPasswordDialog user={user} open={pwOpen} onOpenChange={setPwOpen} />
    </Dialog>
  );
}