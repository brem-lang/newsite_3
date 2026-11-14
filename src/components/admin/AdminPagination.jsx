import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const SIZES = [25, 50, 100];

/**
 * Shared footer for every admin table: page stepper + page-size picker.
 * Works for both server-paginated (page()) and locally sliced lists.
 */
export default function AdminPagination({ page, pageSize, total, onPage, onPageSize, className = "" }) {
  const { lang } = useI18n();
  const L = (en, ar) => (lang === "ar" ? ar : en);
  const pageCount = Math.max(1, Math.ceil((total || 0) / (pageSize || 25)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border ${className}`}>
      <p className="text-xs text-muted-foreground tabular-nums">
        {L(`${from}–${to} of ${total}`, `${from}–${to} من ${total}`)}
      </p>

      <div className="flex items-center gap-3">
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label={L("Rows per page", "صفوف لكل صفحة")}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{L(`${s} / page`, `${s} / صفحة`)}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          <Button
            size="icon" variant="outline" className="h-8 w-8"
            disabled={page <= 1} onClick={() => onPage(page - 1)}
            aria-label={L("Previous page", "الصفحة السابقة")}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {L(`Page ${page} / ${pageCount}`, `صفحة ${page} / ${pageCount}`)}
          </span>
          <Button
            size="icon" variant="outline" className="h-8 w-8"
            disabled={page >= pageCount} onClick={() => onPage(page + 1)}
            aria-label={L("Next page", "الصفحة التالية")}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Local slice helper for lists that arrive in one payload. */
export function paginate(rows, page, pageSize) {
  const start = (page - 1) * pageSize;
  return (rows || []).slice(start, start + pageSize);
}
