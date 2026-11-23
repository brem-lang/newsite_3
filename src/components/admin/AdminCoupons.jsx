import React, { useState } from "react";
import { Plus, Pencil, Trash2, Ticket, Percent, DollarSign } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogForm } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm, useDiscardGuard } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";
import SelectField from "@/components/ui/select-field";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const NONE = [];

const loadSection = async () => (await base44.entities.Coupon.list("-created_date", 200)) || [];

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["coupons"], loadSection));

export default function AdminCoupons() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const { symbol } = useCurrency();
  const { data: items = NONE, isPending: loading, refresh: load } = useAdminData(["coupons"], loadSection);
  const [open, setOpen] = useState(false);
  const { markDirty, guard } = useDiscardGuard(open);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, min_amount: 0, max_uses: 100, active: true, expires_at: "", description: "" });


  const openNew = () => { setEditing(null); setForm({ code: "", type: "percent", value: 10, min_amount: 0, max_uses: 100, active: true, expires_at: "", description: "" }); setOpen(true); };
  const openEdit = (it) => {
    setEditing(it);
    setForm({
      code: it.code || "", type: it.type || "percent", value: it.value || 0,
      min_amount: it.min_amount || 0, max_uses: it.max_uses || 100,
      active: it.active !== false, expires_at: it.expires_at ? it.expires_at.slice(0, 16) : "",
      description: it.description || ""
    });
    setOpen(true);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleDelete = async (it) => {
    if (!(await askConfirm({ title: t.admin.confirm.deleteCoupon, description: t.admin.confirm.cannotUndo, confirmLabel: t.admin.confirm.delete, destructive: true }))) return;
    try {
      await base44.entities.Coupon.delete(it.id);
      toast.success(t.admin.coupons.deleted);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error(t.admin.coupons.emptyCode); return; }
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type, value: Number(form.value) || 0,
        min_amount: Number(form.min_amount) || 0,
        max_uses: Number(form.max_uses) || 100,
        active: form.active,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        description: form.description
      };
      if (editing) { await base44.entities.Coupon.update(editing.id, payload); toast.success(t.admin.coupons.saved); }
      else { await base44.entities.Coupon.create({ ...payload, uses: 0 }); toast.success(t.admin.coupons.added); }
      setOpen(false); load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const isExpired = (it) => it.expires_at && new Date(it.expires_at) < new Date();

  return (
    <div className="space-y-6">
      <div className="admin-page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.coupons.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.coupons.subtitle}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> {t.admin.coupons.new}</Button>
      </div>

      {loading ? null : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.coupons.noCoupons}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {items.map((it) => {
            const expired = isExpired(it);
            const dead = !it.active || expired;
            return (
              <div key={it.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-10 h-10 rounded-xl grid place-items-center shrink-0", dead ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                    {it.type === "percent" ? <Percent className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold font-mono tracking-wide flex items-center gap-2">
                      {it.code}
                      {dead && <Badge variant="secondary" className="text-[10px]">{expired ? "Expired" : "Off"}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {it.type === "percent" ? `${it.value}% off` : `${symbol}${it.value} off`}
                      {" · "} {it.uses || 0}/{it.max_uses} used
                      {it.expires_at && ` · ${t.admin.coupons.expiresAt}: ${new Date(it.expires_at).toLocaleDateString("en-GB")}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(it)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={guard(setOpen)}>
        <DialogContent onChange={markDirty}>
          <DialogForm onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <DialogHeader><DialogTitle>{editing ? t.admin.edit : t.admin.coupons.new}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-f1">{t.admin.coupons.code}</Label>
                <Input id="coupon-f1" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="SUMMER20" className="font-mono uppercase" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-f2">{t.admin.coupons.type}</Label>
                  <SelectField id="coupon-f2" value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
                    <option value="percent">{t.admin.coupons.typePercent}</option>
                    <option value="fixed">{t.admin.coupons.typeFixed}</option>
                  </SelectField>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-f3">{t.admin.coupons.value}</Label>
                  <Input id="coupon-f3" type="number" value={form.value} onChange={(e) => set("value", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-f4">{t.admin.coupons.minAmount}</Label>
                  <Input id="coupon-f4" type="number" value={form.min_amount} onChange={(e) => set("min_amount", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coupon-f5">{t.admin.coupons.maxUses}</Label>
                  <Input id="coupon-f5" type="number" value={form.max_uses} onChange={(e) => set("max_uses", e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="coupon-f6">{t.admin.coupons.expiresAt}</Label>
                  <Input id="coupon-f6" type="datetime-local" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-f7">{t.admin.categories.description}</Label>
                <Textarea id="coupon-f7" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
                <span className="text-sm">{t.admin.coupons.active}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => guard(setOpen)(false)}>{t.admin.cancel}</Button>
              <Button type="submit">{t.admin.save}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}