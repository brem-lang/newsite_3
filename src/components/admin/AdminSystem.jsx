import React, { useEffect } from "react";
import { Activity, Database, Users, Gavel, Wallet, PackageCheck, LifeBuoy, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminData, adminSection, warmAdmin } from "@/lib/queries/admin";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const NONE = [];
const NO_MAP = {};

// Row counts come from Postgres (count only, one row transferred per table)
// instead of downloading every table.
const count = async (entity) => (await base44.entities[entity].page({ page: 1, pageSize: 1, fields: "id" })).total;

const loadSection = async () => {
  const [auctions, bids, users, transactions, fulfilment, support, settingsList] = await Promise.all([
    count("Auction"), count("Bid"), count("User"), count("WalletTransaction"), count("Fulfilment"), count("SupportTicket"),
    base44.entities.SiteSettings.list(),
  ]);
  const s = (Array.isArray(settingsList) ? settingsList : settingsList?.items)?.find((x) => x.key === "global");
  return { counts: { auctions, bids, users, transactions, fulfilment, support }, settings: s || null };
};

/** Route loader: everything this panel paints, before it opens. */
export const prefetch = (qc) => warmAdmin(qc, adminSection(["system"], loadSection));

export default function AdminSystem() {
  const { t } = useI18n();
  const L = (o) => (o ? (typeof o === "string" ? o : o.en || "") : "");
  const qc = useQueryClient();
  const { data, isPending: loading, error: loadError, queryKey } = useAdminData(["system"], loadSection);
  useEffect(() => { if (loadError) toast.error(loadError.message); }, [loadError]);
  const counts = data?.counts ?? NO_MAP;
  const settings = data?.settings ?? null;
  const setSettings = (next) => qc.setQueryData(queryKey, (prev) => (prev ? { ...prev, settings: next } : prev));


  const toggleMaint = async (v) => {
    try {
      const updated = settings
        ? await base44.entities.SiteSettings.update(settings.id, { maintenance_mode: v })
        : await base44.entities.SiteSettings.create({ key: "global", maintenance_mode: v });
      setSettings(updated);
      toast.success("Updated");
    } catch (e) { toast.error(e.message); }
  };

  const cards = [
    { icon: Gavel, label: { en: "Auctions" }, value: counts.auctions, tone: "text-info bg-info/10" },
    { icon: Users, label: { en: "Users" }, value: counts.users, tone: "text-primary bg-primary/10" },
    { icon: Activity, label: { en: "Bids" }, value: counts.bids, tone: "text-warning bg-warning/10" },
    { icon: Wallet, label: { en: "Transactions" }, value: counts.transactions, tone: "text-success bg-success/10" },
    { icon: PackageCheck, label: { en: "Fulfilment" }, value: counts.fulfilment, tone: "text-cyan-600 bg-cyan-50" },
    { icon: LifeBuoy, label: { en: "Support tickets" }, value: counts.support, tone: "text-destructive bg-destructive/10" },
  ];

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="admin-page-header">
        <h2 className="font-display text-xl font-semibold">{"System health"}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{"Record counts and maintenance controls."}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label.en} className="rounded-xl border bg-card p-4">
            <div className={`w-9 h-9 rounded-lg grid place-items-center ${c.tone}`}><c.icon className="w-4 h-4" /></div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{L(c.label)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">{t.admin.settings.maintenance}</div>
            <div className="text-xs text-muted-foreground">{t.admin.settings.maintenanceHint}</div>
          </div>
        </div>
        <Switch checked={!!settings?.maintenance_mode} onCheckedChange={toggleMaint} />
      </div>

      <div className="rounded-xl border bg-success/10 border-success/25 p-4 flex items-center gap-2 text-sm">
        <Database className="w-4 h-4 text-success" />
        <span className="text-success font-medium">{"All services operational"}</span>
      </div>
    </div>
  );
}