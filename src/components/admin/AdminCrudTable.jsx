import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminKeys } from "@/lib/queries/keys";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import AdminPagination from "@/components/admin/AdminPagination";
import { logAdminAction } from "@/lib/adminAudit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogForm } from "@/components/ui/dialog";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SelectField from "@/components/ui/select-field";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT = "-created_date";
const EXPORT_BATCH = 1000;

const initialFor = (f) => (f.type === "boolean" ? false : f.type === "number" ? 0 : f.type === "select" ? (f.options?.[0]?.value ?? "") : "");
const defaultForm = (fields) => Object.fromEntries(fields.map((f) => [f.key, initialFor(f)]));
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f.key, row?.[f.key] ?? initialFor(f)]));
const buildForm = (fields, row) => ({ ...defaultForm(fields), ...pick(row, fields) });

const csvCell = (v) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Columns the server-side search can `ilike` against: text-like table columns.
 * Numbers, booleans, JSON and fields marked `searchable: false` (e.g. timestamps) are skipped.
 */
const TEXT_TYPES = new Set([undefined, "text", "url", "textarea", "select"]);
const searchColumns = (fields) =>
  fields.filter((f) => !f.hideInTable && f.searchable !== false && TEXT_TYPES.has(f.type)).map((f) => f.key);

const sortParam = (sort) => (sort.key ? `${sort.dir === "desc" ? "-" : ""}${sort.key}` : DEFAULT_SORT);

/** Query options for one page of an entity, filtered, sorted and counted in Postgres. */
const crudPageQuery = (entity, { page = 1, pageSize = DEFAULT_PAGE_SIZE, term = "", sort = DEFAULT_SORT, columns = [] } = {}) => ({
  queryKey: adminKeys.entityPage(entity, { page, pageSize, term, sort }),
  queryFn: () => base44.entities[entity].page({ page, pageSize, sort, search: { term, columns } }),
  staleTime: 30_000,
  placeholderData: keepPreviousData,
});

/** A panel's route prefetch: `export const prefetch = prefetchCrud("Brand")` warms the first page. */
export const prefetchCrud = (entity) => (qc) => qc.ensureQueryData(crudPageQuery(entity)).catch(() => undefined);

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const { t } = useI18n();
  const askConfirm = useConfirm();

  const term = useDebouncedValue(query.trim());
  const columns = useMemo(() => searchColumns(fields), [fields]);
  const sortBy = sortParam(sort);

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => { setPage(1); }, [term, sortBy, pageSize]);

  const { data, isLoading, isError, error, isFetching, isPlaceholderData, refetch } = useQuery(
    crudPageQuery(entity, { page, pageSize, term, sort: sortBy, columns }),
  );
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pageCount = data?.pageCount || 1;
  const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.entity(entity) });

  // A delete can empty the last page: step back to the new last page.
  useEffect(() => {
    if (data && !isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [data, isPlaceholderData, page, pageCount]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  /** Exports every row matching the current search, fetched in batches (not just the visible page). */
  const exportCsv = async () => {
    setExporting(true);
    let all = [];
    try {
      for (let p = 1; ; p++) {
        const res = await base44.entities[entity].page({
          page: p, pageSize: EXPORT_BATCH, sort: sortBy, search: { term, columns },
        });
        all = all.concat(res.rows);
        if (p >= res.pageCount) break;
      }
    } catch (e) {
      toast.error(e.message);
      setExporting(false);
      return;
    }
    setExporting(false);
    const header = cols.map((f) => csvCell(L(f.label))).join(",");
    const body = all.map((r) => cols.map((f) => csvCell(r[f.key])).join(",")).join("\n");
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
    // admin-fill / admin-table-card: the table fills the visible height (src/styles.css).
    <div className="space-y-4 admin-fill">
      <div className="admin-page-header flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">{L(title)}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{L(subtitle)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title={"Refresh"}>
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!total || exporting}>
            <Download className={cn("w-4 h-4", exporting && "animate-pulse")} /> CSV
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={"Search…"}
            className="ps-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {total} {"records"}
        </span>
      </div>

      {isLoading ? null : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
          <p className="text-sm text-destructive">{error?.message || "Failed to load data."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>{"Try again"}</Button>
        </div>
      ) : total === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
          {term ? "No matching records." : L(emptyLabel)}
        </div>
      ) : (
        <div className={cn("admin-table-card rounded-2xl border border-border bg-card overflow-hidden", isPlaceholderData && "opacity-60")}>
          <div className="admin-table-scroll">
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
                {rows.map((r) => (
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

          <AdminPagination
            page={Math.min(page, pageCount)} pageSize={pageSize} total={total}
            onPage={setPage} onPageSize={setPageSize}
          />
        </div>
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
                    <Input value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  ) : f.type === "number" ? (
                    <Input type="number" value={form[f.key] ?? 0} onChange={(e) => set(f.key, e.target.value)} />
                  ) : f.type === "textarea" || f.type === "json" ? (
                    <Textarea rows={f.rows || 4} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className="font-mono" placeholder={f.placeholder} />
                  ) : f.type === "select" ? (
                    <SelectField
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      {(f.options || []).map((o) => (<option key={o.value} value={o.value}>{L(o.label)}</option>))}
                    </SelectField>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Switch checked={!!form[f.key]} onCheckedChange={(v) => set(f.key, v)} />
                      <Label>{L(f.label)}</Label>
                    </div>
                  ) : null}
                  {f.hint ? <p className="text-xs text-muted-foreground">{L(f.hint)}</p> : null}
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
