import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, Pencil, Trash2, Globe, X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { configKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm
} from "@/components/ui/dialog";
import SelectField from "@/components/ui/select-field";

const COMMON = ["USD", "EUR", "GBP", "JOD", "SAR", "AED", "EGP", "QAR", "KWD", "BHD", "OMR"];

const NONE = [];

const loadSection = async () => {
  const [rows, settings] = await Promise.all([
    base44.entities.PaymentMethod.list("display_order", 100),
    base44.entities.SiteSettings.filter({ key: "global" }),
  ]);
  return { methods: rows || [], settings: settings?.[0] || null };
};

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["payment_methods"], loadSection));

export default function AdminPaymentMethods() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const m = t.admin.payments;
  const qc = useQueryClient();
  const { data, isPending: loading, refresh } = useAdminData(["payment_methods"], loadSection);
  const methods = data?.methods ?? NONE;
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [currency, setCurrency] = useState("USD");
  const [settingsId, setSettingsId] = useState(null);

  // Seed the editable currency field from the saved settings row.
  useEffect(() => {
    const s = data?.settings;
    if (s) { setSettingsId(s.id); setCurrency(s.active_currency || "USD"); }
  }, [data?.settings]);

  // Re-read this panel and the site-wide payment-method / settings caches.
  const load = useCallback(() => {
    refresh();
    qc.invalidateQueries({ queryKey: configKeys.paymentMethods() });
    qc.invalidateQueries({ queryKey: configKeys.settings() });
  }, [refresh, qc]);

  const openNew = () => { setForm(emptyForm()); setDialog(true); };
  const openEdit = (method) => {
    setForm({ ...emptyForm(), ...method, id: method.id, hasCred: method.type === "live_gateway" });
    if (method.type === "live_gateway") {
      base44.entities.PaymentMethodCredential.filter({ payment_method_id: method.id }).then((rows) => {
        const c = rows?.[0] || {};
        setForm((f) => ({ ...f, credId: c.id || "", secret_key: c.secret_key || "", publishable_key: c.publishable_key || "" }));
      }).catch(() => {});
    }
    setDialog(true);
  };

  const save = async () => {
    if (!form.name) return toast.error(m.methodName);
    setBusy(true);
    try {
      let methodId = form.id;
      const payload = {
        name: form.name,
        type: form.type,
        provider: form.provider,
        logo: form.logo,
        instructions: form.instructions,
        enabled: form.enabled,
        display_order: Number(form.display_order) || 0
      };
      if (form.id) {
        await base44.entities.PaymentMethod.update(form.id, payload);
      } else {
        const created = await base44.entities.PaymentMethod.create(payload);
        methodId = created.id;
      }
      if (form.type === "live_gateway" && methodId) {
        const cred = { payment_method_id: methodId, secret_key: form.secret_key, publishable_key: form.publishable_key };
        if (form.credId) await base44.entities.PaymentMethodCredential.update(form.credId, cred);
        else await base44.entities.PaymentMethodCredential.create(cred);
      }
      toast.success(m.saved);
      setDialog(false);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!(await askConfirm({ title: t.admin.confirm.deletePaymentMethod, description: t.admin.confirm.cannotUndo, confirmLabel: t.admin.confirm.delete, destructive: true }))) return;
    try {
      const creds = await base44.entities.PaymentMethodCredential.filter({ payment_method_id: id });
      if (creds?.[0]) await base44.entities.PaymentMethodCredential.delete(creds[0].id);
      await base44.entities.PaymentMethod.delete(id);
      toast.success(m.deleted);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const toggleEnabled = async (method) => {
    try {
      await base44.entities.PaymentMethod.update(method.id, { enabled: !method.enabled });
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const saveCurrency = async (code) => {
    setCurrency(code);
    try {
      if (settingsId) await base44.entities.SiteSettings.update(settingsId, { active_currency: code });
      else {
        const created = await base44.entities.SiteSettings.create({ key: "global", active_currency: code });
        setSettingsId(created.id);
      }
      qc.invalidateQueries({ queryKey: configKeys.settings() });
      toast.success(t.admin.payments.currencySaved || "Saved");
    } catch (e) { toast.error(e.message || "Error"); }
  };

  if (loading) return null;

  const typeLabel = (type) => ({
    live_gateway: m.typeLive, manual: m.typeManual, transfer: m.typeTransfer, cod: m.typeCod
  })[type] || type;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight flex items-center gap-2"><CreditCard className="w-5 h-5" />{m.methods}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.payments.methodsSub}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />{m.addMethod}</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
        <Globe className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium">{t.admin.payments.currency}</span>
        <Input
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="USD"
          className="w-24 uppercase tracking-wide font-semibold"
        />
        <Button size="sm" onClick={() => { const c = currency.trim(); if (c) saveCurrency(c); }}>{t.admin.save}</Button>
        <div className="flex gap-1 flex-wrap">
          {COMMON.map((c) => (
            <button key={c} onClick={() => saveCurrency(c)} className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border", currency === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary/60")}>{c}</button>
          ))}
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">{t.admin.payments.noMethods}</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {methods.map((method) => (
            <div key={method.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {method.logo ? <img src={method.logo} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-secondary grid place-items-center"><CreditCard className="w-5 h-5 text-muted-foreground" /></div>}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{method.name}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(method.type)} {method.provider ? `· ${method.provider}` : ""}</p>
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full", method.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                  {method.enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {method.enabled ? m.methodEnabled : m.methodDisabled}
                </span>
              </div>
              {method.instructions && <p className="text-xs text-muted-foreground mt-3 line-clamp-2 whitespace-pre-line">{method.instructions}</p>}
              <div className="flex items-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(method)} className="gap-1.5"><Pencil className="w-3.5 h-3.5" />{t.admin.edit}</Button>
                <Button variant="outline" size="sm" onClick={() => toggleEnabled(method)}>{method.enabled ? m.disable : m.enable}</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(method.id)} className="text-destructive hover:text-destructive gap-1.5"><Trash2 className="w-3.5 h-3.5" />{t.admin.delete}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); save(); }}>
            <DialogHeader><DialogTitle>{form.id ? t.admin.edit : m.addMethod}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <Field label={m.methodName}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={m.methodType}>
                  <SelectField value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {["live_gateway", "manual", "transfer", "cod"].map((tp) => <option key={tp} value={tp}>{typeLabel(tp)}</option>)}
                  </SelectField>
                </Field>
                <Field label={m.methodProvider}>
                  <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="stripe, paypal…" disabled={form.type !== "live_gateway"} />
                </Field>
              </div>
              <Field label={m.methodLogo}>
                <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://…" />
              </Field>
              <Field label={m.methodInstructions}>
                <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              </Field>
              {form.type === "live_gateway" && (
                <div className="space-y-3 rounded-xl bg-muted/30 border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{t.admin.payments.credentials}</p>
                  <Field label={m.methodSecret}><Input type="password" value={form.secret_key} onChange={(e) => setForm({ ...form, secret_key: e.target.value })} placeholder="sk_live_…" /></Field>
                  <Field label={m.methodPublishable}><Input value={form.publishable_key} onChange={(e) => setForm({ ...form, publishable_key: e.target.value })} placeholder="pk_live_…" /></Field>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4" />
                {m.methodEnabled}
              </label>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
              <Button type="submit" disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyForm() {
  return { id: "", name: "", type: "manual", provider: "", logo: "", instructions: "", enabled: true, display_order: 0, secret_key: "", publishable_key: "", credId: "" };
}

function Field({ label, children }) {
  return <FormField label={label} className="space-y-1" labelClassName="text-xs">{children}</FormField>;
}