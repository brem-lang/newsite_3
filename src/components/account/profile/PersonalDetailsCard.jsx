import React, { useEffect, useMemo, useState } from "react";
import { UserRound, Phone, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { countryList, dialCode, dialCodeList } from "@/lib/countries";
import SelectField from "@/components/ui/select-field";

const FIELDS = [
  "first_name",
  "last_name",
  "phone_country_code",
  "phone_number",
  "whatsapp_country_code",
  "whatsapp_number",
  "country_code",
];

const splitPhone = (raw) => {
  const value = (raw || "").trim();
  const m = value.match(/^(\+\d{1,4})[\s-]*(.*)$/);
  if (m) return { cc: m[1], num: m[2].replace(/\s+/g, "") };
  return { cc: "", num: value.replace(/\s+/g, "") };
};

export default function PersonalDetailsCard({ user, onSaved, compact = false }) {
  const { t } = useI18n();
  const p = t.account.profile;
  const locale = "en";
  const countries = useMemo(() => countryList(locale), [locale]);
  const dials = useMemo(() => dialCodeList(locale), [locale]);

  const [form, setForm] = useState(() => FIELDS.reduce((a, k) => ({ ...a, [k]: "" }), {}));
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const phone = splitPhone(user.phone);
    const wCc = user.whatsapp_country_code || phone.cc || dialCode(user.country_code);
    const wNum = user.whatsapp_number || "";
    const next = {
      first_name: user.first_name || (user.full_name || "").split(" ")[0] || "",
      last_name: user.last_name || (user.full_name || "").split(" ").slice(1).join(" ") || "",
      phone_country_code: phone.cc || wCc || "",
      phone_number: phone.num || wNum || "",
      whatsapp_country_code: wCc || "",
      whatsapp_number: wNum,
      country_code: user.country_code || "",
    };
    setForm(next);
    setSameAsPhone(
      !!next.phone_number && next.phone_number === next.whatsapp_number && next.phone_country_code === next.whatsapp_country_code
    );
  }, [user]);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      if (sameAsPhone && k === "phone_number") next.whatsapp_number = value;
      if (sameAsPhone && k === "phone_country_code") next.whatsapp_country_code = value;
      return next;
    });
  };

  const toggleSame = (checked) => {
    setSameAsPhone(checked);
    if (checked) {
      setForm((f) => ({ ...f, whatsapp_country_code: f.phone_country_code, whatsapp_number: f.phone_number }));
    }
  };

  const save = async () => {
    if (!user?.id) return;
    if (!form.first_name.trim()) { toast.error(p.errFirstName); return; }
    if (!form.last_name.trim()) { toast.error(p.errLastName); return; }
    const cc = form.phone_country_code.trim();
    const num = form.phone_number.replace(/\D/g, "");
    if (!/^\+?\d{1,4}$/.test(cc) || num.length < 6) { toast.error(p.errPhone); return; }
    const normCc = cc.startsWith("+") ? cc : `+${cc}`;
    const wCcRaw = (sameAsPhone ? normCc : form.whatsapp_country_code || normCc).trim();
    const wCc = wCcRaw.startsWith("+") ? wCcRaw : `+${wCcRaw}`;
    const wNum = (sameAsPhone ? num : form.whatsapp_number.replace(/\D/g, "")) || num;

    setSaving(true);
    try {
      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      await base44.entities.User.update(user.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name,
        phone: `${normCc} ${num}`,
        whatsapp_country_code: wCc,
        whatsapp_number: wNum,
        country_code: form.country_code || null,
        country: form.country_code ? countries.find((c) => c.code === form.country_code)?.name || null : null,
      });
      toast.success(p.saved);
      onSaved?.();
    } catch (e) {
      toast.error(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const label = "text-[11px] font-semibold text-muted-foreground";
  const box = compact
    ? "rounded-2xl bg-card border border-border p-3 space-y-3 shadow-sm"
    : "rounded-2xl border border-border bg-card p-5 space-y-4";
  const selectCls =
    "h-10 min-w-0 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className={box}>
      <div>
        <h2 className="font-heading text-base font-semibold flex items-center gap-2">
          <UserRound className="w-4 h-4 text-primary" /> {p.personal}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{p.personalSubtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className={label}>{p.firstName}</p>
          <Input value={form.first_name} onChange={set("first_name")} className="h-10" autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <p className={label}>{p.lastName}</p>
          <Input value={form.last_name} onChange={set("last_name")} className="h-10" autoComplete="family-name" />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={label}>{p.email}</p>
        <Input value={user?.email || ""} readOnly disabled className="h-10 bg-muted/60" />
        <p className="text-[11px] text-muted-foreground">{p.emailLocked}</p>
      </div>

      <div className="space-y-1.5">
        <p className={`${label} flex items-center gap-1.5`}><Phone className="w-3 h-3" /> {p.phone}</p>
        <div className="flex gap-2 min-w-0">
          <SelectField value={form.phone_country_code} onChange={set("phone_country_code")} className={`${selectCls} w-24 shrink-0`}>
            <option value="">+</option>
            {dials.map((c) => (
              <option key={c.code} value={c.dial}>{`${c.dial} ${c.code}`}</option>
            ))}
          </SelectField>
          <Input value={form.phone_number} onChange={set("phone_number")} placeholder="790000000" className="h-10 flex-1 min-w-0" inputMode="tel" autoComplete="tel-national" />
        </div>
        <p className="text-[11px] text-muted-foreground">{p.phoneHint}</p>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
        <input type="checkbox" checked={sameAsPhone} onChange={(e) => toggleSame(e.target.checked)} className="w-4 h-4 rounded border-input accent-[hsl(var(--primary))]" />
        {p.sameAsPhone}
      </label>

      {!sameAsPhone && (
        <div className="space-y-1.5">
          <p className={`${label} flex items-center gap-1.5`}><MessageCircle className="w-3 h-3" /> {p.whatsapp}</p>
          <div className="flex gap-2 min-w-0">
            <SelectField value={form.whatsapp_country_code} onChange={set("whatsapp_country_code")} className={`${selectCls} w-24 shrink-0`}>
              <option value="">+</option>
              {dials.map((c) => (
                <option key={c.code} value={c.dial}>{`${c.dial} ${c.code}`}</option>
              ))}
            </SelectField>
            <Input value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="790000000" className="h-10 flex-1 min-w-0" inputMode="tel" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className={label}>{p.country}</p>
        <SelectField value={form.country_code} onChange={set("country_code")} className={`${selectCls} w-full`}>
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </SelectField>
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-10">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin me-2" /> {p.saving}</> : p.savePersonal}
      </Button>
    </div>
  );
}
