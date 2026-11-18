import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogForm } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";

const slugify = (s) => s.toLowerCase().trim().replace(/[^\w\u0600-\u06FF\s-]/g, "").replace(/\s+/g, "-");

export default function AdminCategories() {
  const { t } = useI18n();
  const askConfirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", slug: "", color: "#3b82f6", icon: "", description: "", sort_order: 0, active: true });

  const load = useCallback(() => {
    base44.entities.Category.list("sort_order", 200)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ name: "", slug: "", color: "#3b82f6", icon: "", description: "", sort_order: 0, active: true }); setOpen(true); };
  const openEdit = (it) => {
    setEditing(it);
    setForm({ name: it.name || "", slug: it.slug || "", color: it.color || "#3b82f6", icon: it.icon || "", description: it.description || "", sort_order: it.sort_order || 0, active: it.active !== false });
    setOpen(true);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleDelete = async (it) => {
    if (!(await askConfirm({ title: t.admin.confirm.deleteCategory, description: t.admin.confirm.cannotUndo, confirmLabel: t.admin.confirm.delete, destructive: true }))) return;
    try {
      await base44.entities.Category.delete(it.id);
      toast.success(t.admin.categories.deleted);
      load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t.admin.categories.emptyName); return; }
    try {
      const payload = {
        ...form,
        slug: form.slug.trim() || slugify(form.name),
        sort_order: Number(form.sort_order) || 0
      };
      if (editing) { await base44.entities.Category.update(editing.id, payload); toast.success(t.admin.categories.saved); }
      else { await base44.entities.Category.create(payload); toast.success(t.admin.categories.added); }
      setOpen(false); load();
    } catch (e) { toast.error(e.message || "Error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.admin.categories.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.admin.categories.subtitle}</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> {t.admin.categories.new}</Button>
      </div>

      {loading ? (
        <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.admin.categories.noCategories}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl grid place-items-center text-lg shrink-0" style={{ backgroundColor: (it.color || "#3b82f6") + "22", color: it.color || "#3b82f6" }}>
                  {it.icon || "🏷️"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{it.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.slug}</p>
                  <span className={cn("text-[10px] font-bold", it.active !== false ? "text-success" : "text-muted-foreground")}>
                    {it.active !== false ? "● Active" : "○ Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(it)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogForm onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <DialogHeader><DialogTitle>{editing ? t.admin.edit : t.admin.categories.new}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category-f1">{t.admin.categories.name}</Label>
                  <Input id="category-f1" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-f2">{t.admin.categories.slug}</Label>
                  <Input id="category-f2" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-f3">{t.admin.categories.icon}</Label>
                  <Input id="category-f3" value={form.icon} onChange={(e) => set("icon", e.target.value)} placeholder="🏆" className="text-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-color">{t.admin.categories.color}</Label>
                  <div className="flex gap-2">
                    <input type="color" aria-label={t.admin.categories.color} value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9 w-12 rounded-md border border-input bg-background cursor-pointer" />
                    <Input id="category-color" value={form.color} onChange={(e) => set("color", e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-f4">{t.admin.categories.sortOrder}</Label>
                  <Input id="category-f4" type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
                    <span className="text-sm">{t.admin.categories.active}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-f5">{t.admin.categories.description}</Label>
                <Textarea id="category-f5" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t.admin.cancel}</Button>
              <Button type="submit">{t.admin.save}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}