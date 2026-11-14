import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function RefundRequestsList({ userId }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!userId) return;
    base44.entities.RefundRequest.filter({ user_id: userId }, "-created_date", 50)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (rows.length === 0) return null;

  const statusMeta = (s) => ({
    pending: { label: t.refund.status.pending, icon: Clock, cls: "text-warning" },
    approved: { label: t.refund.status.approved, icon: CheckCircle2, cls: "text-success" },
    rejected: { label: t.refund.status.rejected, icon: XCircle, cls: "text-destructive" }
  }[s]);

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" /> {t.refund.section}
      </h2>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {rows.map((r) => {
          const m = statusMeta(r.status);
          const Icon = m.icon;
          return (
            <div key={r.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  {m.label}
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", m.cls)}><Icon className="w-3.5 h-3.5" /></span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(r.created_date).toLocaleString("en-GB")}</p>
                {r.reason && <p className="text-xs text-muted-foreground mt-1">“{r.reason}”</p>}
                {r.admin_note && <p className="text-xs text-muted-foreground mt-1">{r.admin_note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}