import React, { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const FIELDS = ["address_line1", "address_line2", "address_city", "address_state", "address_country", "address_zip"];

export default function AddressCard({ user, onSaved, compact = false }) {
  const { t } = useI18n();
  const p = t.account.profile;
  const [form, setForm] = useState(() => FIELDS.reduce((a, k) => ({ ...a, [k]: "" }), {}));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm(FIELDS.reduce((a, k) => ({ ...a, [k]: user[k] || "" }), {}));
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, form);
      toast.success(p.saved);
      onSaved?.();
    } catch (e) {
      toast.error(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const box = compact
    ? "rounded-2xl bg-card border border-border p-3 space-y-3 shadow-sm"
    : "rounded-2xl border border-border bg-card p-5 space-y-4";

  return (
    <div className={box}>
      <div>
        <h2 className="font-heading text-base font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> {p.address}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{p.addressSubtitle}</p>
      </div>

      <div className="space-y-2">
        <Input value={form.address_line1} onChange={set("address_line1")} placeholder={p.line1} className="h-10" />
        <Input value={form.address_line2} onChange={set("address_line2")} placeholder={p.line2} className="h-10" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.address_city} onChange={set("address_city")} placeholder={p.city} className="h-10" />
          <Input value={form.address_state} onChange={set("address_state")} placeholder={p.state} className="h-10" />
          <Input value={form.address_country} onChange={set("address_country")} placeholder={p.country} className="h-10" />
          <Input value={form.address_zip} onChange={set("address_zip")} placeholder={p.zip} className="h-10" />
        </div>
      </div>

      <Button onClick={save} disabled={saving} variant="secondary" className="w-full h-10">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin me-2" /> {p.saving}</> : p.saveAddress}
      </Button>
    </div>
  );
}
