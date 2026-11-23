import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
// Uploads use the staff session; the bucket is public-read, staff-write.
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ImageIcon, Check, RefreshCw, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SelectField from "@/components/ui/select-field";

const BUCKET = "auction-images";
const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const PAGE_SIZE = 12;
const MAX_FILES = 500;

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A–Z" }
];

export default function ImagePicker({ value, onChange, label = "Image" }) {
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const fileRef = useRef(null);

  const loadPool = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list("", {
        limit: MAX_FILES,
        sortBy: { column: "created_at", order: "desc" }
      });
      if (error) throw error;
      const files = (data || []).filter((f) => f.id);
      if (!files.length) { setPool([]); return; }
      setPool(
        files.map((f) => ({
          name: f.name,
          url: publicUrl(f.name),
          createdAt: f.created_at || f.updated_at || null,
          size: f.metadata?.size || 0
        }))
      );
    } catch (e) {
      toast.error(e.message || "Could not load images");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) loadPool(); }, [open, loadPool]);
  useEffect(() => { setPage(1); }, [query, sort, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? pool.filter((img) => img.name.toLowerCase().includes(q)) : [...pool];
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "en");
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sort === "oldest" ? at - bt : bt - at;
    });
    return list;
  }, [pool, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type
      });
      if (error) throw error;
      onChange(publicUrl(path));
      setQuery("");
      setSort("newest");
      setPage(1);
      setOpen(true);
      loadPool();
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0 rounded-lg border border-input bg-muted overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://... or upload" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploading ? "Uploading..." : "Upload image"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              {open ? "Hide library" : "Image library"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Clear</Button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="rounded-lg border border-input p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{label} library</span>
            <Button type="button" variant="ghost" size="sm" onClick={loadPool} disabled={loading} aria-label="Refresh library">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Enter filters as you type already; don't let it submit a surrounding form.
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                placeholder="Search by file name"
                aria-label="Search images"
                className="h-9 ps-8 pe-8 text-xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <SelectField
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort images"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {pool.length === 0
                ? "No images yet — upload one to start your pool."
                : "No images match your search."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {pageItems.map((img) => (
                  <button key={img.name} type="button" onClick={() => onChange(img.url)} title={img.name}
                    aria-pressed={value === img.url}
                    className={cn(
                      "relative aspect-square rounded-md overflow-hidden border-2 transition-all",
                      value === img.url ? "border-primary" : "border-transparent hover:border-muted-foreground/40"
                    )}>
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                    {value === img.url && (
                      <span className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  {filtered.length} image{filtered.length === 1 ? "" : "s"} · page {currentPage}/{totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2"
                    disabled={currentPage <= 1} aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2"
                    disabled={currentPage >= totalPages} aria-label="Next page"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
