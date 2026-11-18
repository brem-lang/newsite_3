import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function AdminContent() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ key: "", label: "", value_en: "" });

  const load = useCallback(() => {
    base44.entities.Content.list("-created_date", 200)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ key: "", label: "", value_en: "" });
    setOpen(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setForm({ key: it.key, label: it.label || "", value_en: it.value_en || "" });
    setOpen(true);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleDelete = async (it) => {
    if (!(await askConfirm({ title: t.admin.confirm.deleteContent, description: t.admin.confirm.cannotUndo, confirmLabel: t.admin.confirm.delete, destructive: true }))) return;
    try {
      await base44.entities.Content.delete(it.id);
      toast.success(t.admin.content.deleted);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const handleSave = async () => {
    if (!form.key.trim() || !form.value_en.trim()) {
      toast.error(`${t.admin.content.key} / ${t.admin.content.value}`);
      return;
    }
    try {
      const payload = {
        key: form.key.trim(),
        label: form.label.trim(),
        value_en: form.value_en
      };
      if (editing) {
        await base44.entities.Content.update(editing.id, payload);
        toast.success(t.admin.content.saved);
      } else {
        await base44.entities.Content.create(payload);
        toast.success(t.admin.content.added);
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.content.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.content.subtitle}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> {t.admin.content.new}</Button>
      </div>

      {loading ? (
        <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {t.admin.content.noContent}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const preview = it.value_en;
            return (
              <div key={it.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">{it.key}</code>
                    {it.label && <span className="text-sm font-medium">{it.label}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(it)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.admin.edit : t.admin.content.new}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.admin.content.key}</Label>
              <Input value={form.key} onChange={(e) => set("key", e.target.value)} disabled={!!editing} placeholder="hero_title" />
              <p className="text-xs text-muted-foreground">{t.admin.content.keyHint}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.content.label}</Label>
              <Input value={form.label} onChange={(e) => set("label", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.content.value}</Label>
              <textarea rows={3} value={form.value_en} onChange={(e) => set("value_en", e.target.value)} className={inputCls} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.admin.cancel}</Button>
            <Button onClick={handleSave}>{t.admin.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}