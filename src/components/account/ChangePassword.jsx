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
  const { t, dir } = useI18n();
  const L = (o) => (dir === "rtl" ? o.ar : o.en);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.current || !form.next || !form.confirm) {
      toast.error(L({ en: "Please fill in all fields", ar: "يرجى ملء جميع الحقول" }));
      return;
    }
    if (form.next.length < 8) {
      toast.error(L({ en: "New password must be at least 8 characters", ar: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }));
      return;
    }
    if (form.next !== form.confirm) {
      toast.error(L({ en: "New passwords do not match", ar: "كلمتا المرور غير متطابقتين" }));
      return;
    }
    setBusy(true);
    try {
      await base44.auth.changePassword({
        userId: user.id,
        currentPassword: form.current,
        newPassword: form.next,
      });
      toast.success(L({ en: "Password updated successfully", ar: "تم تحديث كلمة المرور بنجاح" }));
      setForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      const st = e?.status;
      if (st === 401) toast.error(L({ en: "Current password is incorrect", ar: "كلمة المرور الحالية غير صحيحة" }));
      else if (st === 422) toast.error(L({ en: "New password does not meet requirements", ar: "كلمة المرور الجديدة لا تستوفي المتطلبات" }));
      else toast.error(e.message || L({ en: "Failed to update password", ar: "فشل تحديث كلمة المرور" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "rounded-2xl border border-border bg-card p-5 space-y-4"}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-lg font-semibold">{L({ en: "Change password", ar: "تغيير كلمة المرور" })}</h2>
        </div>
      )}
      <div className={embedded ? "space-y-3" : "grid sm:grid-cols-3 gap-3"}>
        <div>
          <Label className="text-xs">{L({ en: "Current password", ar: "كلمة المرور الحالية" })}</Label>
          <Input type={show ? "text" : "password"} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">{L({ en: "New password", ar: "كلمة المرور الجديدة" })}</Label>
          <Input type={show ? "text" : "password"} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">{L({ en: "Confirm new password", ar: "تأكيد كلمة المرور" })}</Label>
          <Input type={show ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className={cn("flex items-center gap-2", embedded ? "justify-between pt-1" : "justify-between flex-wrap")}>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {show ? L({ en: "Hide", ar: "إخفاء" }) : L({ en: "Show", ar: "إظهار" })}
        </Button>
        <Button onClick={submit} disabled={busy} className={cn("gap-1.5", embedded && "min-w-[9rem]")}>
          {busy ? (t.admin?.saving || "…") : L({ en: "Update password", ar: "تحديث كلمة المرور" })}
        </Button>
      </div>
    </div>
  );
}