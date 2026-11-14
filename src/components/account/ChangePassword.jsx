import React, { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ChangePassword({ user, embedded = false }) {
  const { t } = useI18n();
  const L = (o) => (o.en);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.current || !form.next || !form.confirm) {
      toast.error("Please fill in all fields");
      return;
    }
    if (form.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (form.next !== form.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await base44.auth.changePassword({
        userId: user.id,
        currentPassword: form.current,
        newPassword: form.next,
      });
      toast.success("Password updated successfully");
      setForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      const st = e?.status;
      if (st === 401) toast.error("Current password is incorrect");
      else if (st === 422) toast.error("New password does not meet requirements");
      else toast.error(e.message || "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "rounded-2xl border border-border bg-card p-5 space-y-4"}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-lg font-semibold">{"Change password"}</h2>
        </div>
      )}
      <div className={embedded ? "space-y-3" : "grid sm:grid-cols-3 gap-3"}>
        <div>
          <Label className="text-xs">{"Current password"}</Label>
          <Input type={show ? "text" : "password"} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">{"New password"}</Label>
          <Input type={show ? "text" : "password"} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">{"Confirm new password"}</Label>
          <Input type={show ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className={cn("flex items-center gap-2", embedded ? "justify-between pt-1" : "justify-between flex-wrap")}>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {show ? "Hide" : "Show"}
        </Button>
        <Button onClick={submit} disabled={busy} className={cn("gap-1.5", embedded && "min-w-[9rem]")}>
          {busy ? (t.admin?.saving || "…") : "Update password"}
        </Button>
      </div>
    </div>
  );
}