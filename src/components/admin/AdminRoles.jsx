import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORY_LABELS = {
  overview: { en: "Overview" },
  auctions: { en: "Auctions" },
  users: { en: "Users" },
  finance: { en: "Finance" },
  ops: { en: "Operations" },
  system: { en: "System" },
  general: { en: "General" },
};

/**
 * Roles & access. The hierarchy lives in the database: every role has a rank
 * (level) and an explicit allow/deny per admin capability. The server checks it
 * on every admin action, so the UI here only edits the rules.
 */
export default function AdminRoles() {
  
  const L = (o) => (o ? (typeof o === "string" ? o : o.en || "") : "");

  const [caps, setCaps] = useState([]);
  const [roles, setRoles] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", level: 40, is_system: false, capabilities: {} });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("listRoleAccess", {});
      const payload = res?.data || {};
      if (payload.error) throw new Error(payload.error);
      setCaps(payload.capabilities || []);
      setRoles(payload.roles || []);
      setGrants(payload.grants || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grantMap = useMemo(() => {
    const map = {};
    (grants || []).forEach((g) => {
      map[g.role_id] = map[g.role_id] || {};
      map[g.role_id][g.capability_key] = !!g.allowed;
    });
    return map;
  }, [grants]);

  const effective = useCallback(
    (role, key) => {
      const explicit = grantMap[role.id]?.[key];
      if (explicit !== undefined) return explicit;
      const cap = caps.find((c) => c.key === key);
      return !!cap && Number(cap.min_level) <= Number(role.level || 0);
    },
    [grantMap, caps],
  );

  const grouped = useMemo(() => {
    const out = [];
    caps.forEach((c) => {
      const cat = c.category || "general";
      let bucket = out.find((b) => b.key === cat);
      if (!bucket) { bucket = { key: cat, items: [] }; out.push(bucket); }
      bucket.items.push(c);
    });
    return out;
  }, [caps]);

  const openNew = () => {
    setEditing(null);
    const initial = {};
    caps.forEach((c) => (initial[c.key] = Number(c.min_level) <= 40));
    setForm({ name: "", description: "", level: 40, is_system: false, capabilities: initial });
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    const initial = {};
    caps.forEach((c) => (initial[c.key] = effective(r, c.key)));
    setForm({
      name: r.name || "",
      description: r.description || "",
      level: Number(r.level ?? 40),
      is_system: !!r.is_system,
      capabilities: initial,
    });
    setOpen(true);
  };

  const toggleCap = (key) =>
    setForm((s) => ({ ...s, capabilities: { ...s.capabilities, [key]: !s.capabilities[key] } }));

  const setAll = (value) => {
    const next = {};
    caps.forEach((c) => (next[c.key] = value));
    setForm((s) => ({ ...s, capabilities: next }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      let roleId = editing?.id;
      const payload = {
        name: form.name.trim(),
        description: form.description,
        is_system: !!form.is_system,
        permissions: form.capabilities,
      };
      if (editing) await base44.entities.Role.update(editing.id, payload);
      else roleId = (await base44.entities.Role.create(payload))?.id;

      if (roleId) {
        const res = await base44.functions.invoke("saveRoleAccess", {
          role_id: roleId,
          level: Number(form.level) || 0,
          capabilities: form.capabilities,
        });
        if (res?.data?.error) throw new Error(res.data.error);
      }
      setOpen(false);
      toast.success(editing ? "Saved" : "Added");
      load();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const remove = async (row) => {
    if (row.is_system) { toast.error("Built-in roles cannot be deleted"); return; }
    if (!window.confirm("Delete this role?")) return;
    try {
      await base44.entities.Role.delete(row.id);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.message); }
  };

  const grantedCount = (r) => caps.filter((c) => effective(r, c.key)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{"Roles & access"}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {"Each role has a rank and an explicit list of admin actions. The server enforces it on every request."}
          </p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4" /> {"Add role"}</Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{"Loading…"}</div>
      ) : roles.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground border border-dashed rounded-xl">{"No roles defined yet."}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-3 py-2 whitespace-nowrap">{"Role"}</th>
                <th className="text-start font-medium px-3 py-2 whitespace-nowrap">{"Rank"}</th>
                <th className="text-start font-medium px-3 py-2">{"Description"}</th>
                <th className="text-start font-medium px-3 py-2 whitespace-nowrap">{"Actions allowed"}</th>
                <th className="text-start font-medium px-3 py-2 whitespace-nowrap">{"Built-in"}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      {r.name}
                    </span>
                    {r.slug && <span className="ms-2 text-xs text-muted-foreground">{r.slug}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                      {r.level ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs"><span className="line-clamp-2">{r.description || "—"}</span></td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {grantedCount(r)} / {caps.length}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.is_system ? "text-success" : "text-muted-foreground"}>{r.is_system ? "Yes" : "No"}</span>
                  </td>
                  <td className="px-3 py-2 text-end whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)} disabled={r.is_system}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit role" : "Add role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 max-h-[64vh] overflow-y-auto py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{"Name"} *</Label>
                <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{"Rank (0–100)"}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.level}
                  onChange={(e) => setForm((s) => ({ ...s, level: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {"Higher rank = more senior. Rank alone grants any action at or below it."}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{"Description"}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-2.5">
              <span className="text-sm font-medium">{"Built-in role"}</span>
              <Switch checked={form.is_system} onCheckedChange={(v) => setForm((s) => ({ ...s, is_system: v }))} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{"Admin actions"}</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAll(true)}>{"Select all"}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false)}>{"Clear"}</Button>
                </div>
              </div>
              <div className="space-y-3 rounded-md border p-2.5">
                {grouped.map((bucket) => (
                  <div key={bucket.key} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {L(CATEGORY_LABELS[bucket.key] || { en: bucket.key })}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {bucket.items.map((c) => (
                        <label key={c.key} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!form.capabilities[c.key]}
                            onChange={() => toggleCap(c.key)}
                            className="mt-0.5 h-4 w-4 rounded border-input"
                          />
                          <span className="text-sm leading-tight">
                            {c.label}
                            <span className="block text-xs text-muted-foreground">
                              {"min rank"} {c.min_level}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{"Cancel"}</Button></DialogClose>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
