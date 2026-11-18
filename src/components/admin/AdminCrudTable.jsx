import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { logAdminAction } from "@/lib/adminAudit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const initialFor = (f) => (f.type === "boolean" ? false : f.type === "number" ? 0 : f.type === "select" ? (f.options?.[0]?.value ?? "") : "");
const defaultForm = (fields) => Object.fromEntries(fields.map((f) => [f.key, initialFor(f)]));
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f.key, row?.[f.key] ?? initialFor(f)]));
const buildForm = (fields, row) => ({ ...defaultForm(fields), ...pick(row, fields) });

const csvCell = (v) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function AdminCrudTable({ entity, title, subtitle, addLabel, emptyLabel, fields, readOnly }) {
  
  const L = (o) => (o ? (typeof o === "string" ? o : o.en || "") : "");
  const cols = fields.filter((f) => !f.hideInTable);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm(fields));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(0);
  const { t } = useI18n();
  const askConfirm = useConfirm();

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["admin-entity", entity],
    queryFn: async () => {
      const res = await base44.entities[entity].list();
      return Array.isArray(res) ? res : res?.items || [];
    },
    staleTime: 30_000,
  });
  const rows = data || [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-entity", entity] });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = !q
      ? rows
      : rows.filter((r) => cols.some((f) => String(r[f.key] ?? "").toLowerCase().includes(q)));
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, query, sort, cols]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const paged = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const exportCsv = () => {
    const header = cols.map((f) => csvCell(L(f.label))).join(",");
    const body = filtered.map((r) => cols.map((f) => csvCell(r[f.key])).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const audit = (action, row) => {
    if (entity === "ActivityLog") return;
    logAdminAction(action, { targetType: entity, targetId: row?.id, details: L(title) });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const f of fields) {
        let v = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? 0 : Number(v);
        else if (f.type === "json") {
          try { v = v ? JSON.parse(v) : {}; } catch { throw new Error("Invalid JSON in " + L(f.label)); }
        } else if (f.type === "boolean") v = !!v;
        payload[f.key] = v;
      }
      if (editing) {
        await base44.entities[entity].update(editing.id, payload);
        audit(`${entity}.update`, editing);
      } else {
        const created = await base44.entities[entity].create(payload);
        audit(`${entity}.create`, created);
      }
      setOpen(false);
      toast.success(editing ? "Saved" : "Added");
      invalidate();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const confirmDelete = async (row) => {
    if (!(await askConfirm({ title: t.admin.confirm.deleteItem, description: t.admin.confirm.cannotUndo, confirmLabel: t.admin.confirm.delete, destructive: true }))) return;
    try {
      await base44.entities[entity].delete(row.id);
      audit(`${entity}.delete`, row);
      toast.success("Deleted");
      invalidate();
    } catch (e) { toast.error(e.message); }
  };

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">{L(title)}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{L(subtitle)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title={"Refresh"}>
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={() => { setEditing(null); setForm(defaultForm(fields)); setOpen(true); }}>
              <Plus className="w-4 h-4" /> {L(addLabel)}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={"Search…"}
            className="ps-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {"records"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
          <p className="text-sm text-destructive">{error?.message || "Failed to load data."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>{"Try again"}</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
          {query ? "No matching records." : L(emptyLabel)}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {cols.map((f) => (
                    <th key={f.key} className="text-start font-medium px-3 py-2 whitespace-nowrap">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(f.key)}>
                        {L(f.label)}
                        <ArrowUpDown className={cn("w-3 h-3", sort.key === f.key ? "opacity-100" : "opacity-30")} />
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    {cols.map((f) => (
                      <td key={f.key} className="px-3 py-2 align-top max-w-xs">
                        {f.type === "boolean" ? (
                          <span className={r[f.key] ? "text-success" : "text-muted-foreground"}>{r[f.key] ? "Yes" : "No"}</span>
                        ) : f.type === "select" ? (
                          L((f.options.find((o) => o.value === r[f.key])?.label) || r[f.key])
                        ) : (
                          <span className="line-clamp-2">{String(r[f.key] ?? "")}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm(buildForm(fields, r)); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {"Page"} {current + 1} / {pageCount}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  {"Previous"}
                </Button>
                <Button variant="outline" size="sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
                  {"Next"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogForm onSubmit={(e) => { e.preventDefault(); save(); }}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : L(addLabel)}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  {f.type !== "boolean" && <Label>{L(f.label)}{f.required && " *"}</Label>}
                  {f.type === "text" || f.type === "url" || !f.type ? (
                    <Input value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
                  ) : f.type === "number" ? (
                    <Input type="number" value={form[f.key] ?? 0} onChange={(e) => set(f.key, e.target.value)} />
                  ) : f.type === "textarea" || f.type === "json" ? (
                    <Textarea rows={f.rows || 4} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className="font-mono" />
                  ) : f.type === "select" ? (
                    <select
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      {(f.options || []).map((o) => (<option key={o.value} value={o.value}>{L(o.label)}</option>))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Switch checked={!!form[f.key]} onCheckedChange={(v) => set(f.key, v)} />
                      <Label>{L(f.label)}</Label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{"Cancel"}</Button></DialogClose>
              <Button type="submit" disabled={saving}>{"Save"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
