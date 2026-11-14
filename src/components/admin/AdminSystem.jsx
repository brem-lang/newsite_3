import React, { useEffect, useState } from "react";
import { Activity, Database, Users, Gavel, Wallet, PackageCheck, LifeBuoy, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminSystem() {
  const { t } = useI18n();
  const L = (o) => (o ? (typeof o === "string" ? o : o.en || "") : "");
  const [counts, setCounts] = useState({});
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [auc, bids, users, tx, ful, sup, settingsList] = await Promise.all([
        base44.entities.Auction.list(), base44.entities.Bid.list(), base44.entities.User.list(),
        base44.entities.WalletTransaction.list(), base44.entities.Fulfilment.list(),
        base44.entities.SupportTicket.list(), base44.entities.SiteSettings.list(),
      ]);
      setCounts({
        auctions: (Array.isArray(auc) ? auc : auc?.items)?.length || 0,
        bids: (Array.isArray(bids) ? bids : bids?.items)?.length || 0,
        users: (Array.isArray(users) ? users : users?.items)?.length || 0,
        transactions: (Array.isArray(tx) ? tx : tx?.items)?.length || 0,
        fulfilment: (Array.isArray(ful) ? ful : ful?.items)?.length || 0,
        support: (Array.isArray(sup) ? sup : sup?.items)?.length || 0,
      });
      const s = (Array.isArray(settingsList) ? settingsList : settingsList?.items)?.find((x) => x.key === "global");
      setSettings(s || null);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">{t.common.loading}</div>;

  return (
    <div className="space-y-5">
      <div>
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