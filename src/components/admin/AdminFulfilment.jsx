import React, { useEffect, useState, useCallback } from "react";
import { PackageCheck, Truck, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SHIPPING = ["pending", "shipped", "delivered", "confirmed"];
const PICKUP = ["pending", "ready", "collected", "confirmed"];
const STATUS_CLS = {
  pending: "bg-warning/15 text-warning", shipped: "bg-info/15 text-info", ready: "bg-info/15 text-info",
  delivered: "bg-info/15 text-info", collected: "bg-info/15 text-info", confirmed: "bg-success/15 text-success"
};

export default function AdminFulfilment() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [auctions, setAuctions] = useState({});
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [advance, setAdvance] = useState(null);
  const [form, setForm] = useState({ carrier: "", tracking_number: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      base44.entities.Fulfilment.list("-created_date", 500),
      base44.entities.Auction.list("-created_date", 500),
      base44.entities.User.list("", 500)
    ]).then(([o, a, u]) => {
      setOrders(o || []);
      const am = {}; (a || []).forEach((x) => { am[x.id] = x; }); setAuctions(am);
      const um = {}; (u || []).forEach((x) => { um[x.id] = x; }); setUsers(um);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const nextStatus = (o) => {
    const steps = o.method === "pickup" ? PICKUP : SHIPPING;
    const i = steps.indexOf(o.status);
    return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
  };

  const openAdvance = (o) => {
    setAdvance(o);
    setForm({ carrier: o.carrier || "", tracking_number: o.tracking_number || "", notes: o.notes || "" });
  };

  const confirmAdvance = async () => {
    if (!advance) return;
    setBusy(true);
    try {
      const ns = nextStatus(advance);
      const res = await base44.functions.invoke("updateFulfilment", {
        fulfilment_id: advance.id,
        status: ns,
        carrier: form.carrier,
        tracking_number: form.tracking_number,
        notes: form.notes
      });
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(t.admin.fulfilment.saved);
      setAdvance(null);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (o) => {
    try {
      await base44.entities.Auction.update(o.auction_id, { paid: true });
      toast.success(t.admin.fulfilment.paidDone);
      load();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  if (loading) return <div className="h-64 grid place-items-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const stats = {
    pending: orders.filter((o) => o.status === "pending").length,
    inTransit: orders.filter((o) => o.status === "shipped" || o.status === "ready").length,
    delivered: orders.filter((o) => o.status === "delivered" || o.status === "collected").length,
    done: orders.filter((o) => o.status === "confirmed").length
  };
  const cards = [
    { label: t.admin.fulfilment.stats.pending, value: stats.pending },
    { label: t.admin.fulfilment.stats.inTransit, value: stats.inTransit },
    { label: t.admin.fulfilment.stats.delivered, value: stats.delivered },
    { label: t.admin.fulfilment.stats.done, value: stats.done }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2"><PackageCheck className="w-6 h-6" />{t.admin.fulfilment.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.admin.fulfilment.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-heading text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colAuction}</th>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colWinner}</th>
                <th className="text-start font-medium px-4 py-3 hidden sm:table-cell">{t.admin.fulfilment.colMethod}</th>
                <th className="text-start font-medium px-4 py-3 hidden md:table-cell">{t.admin.fulfilment.colAddress}</th>
                <th className="text-start font-medium px-4 py-3">{t.admin.fulfilment.colStatus}</th>
                <th className="text-end font-medium px-4 py-3">{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">{t.admin.fulfilment.empty}</td></tr>
              ) : orders.map((o) => {
                const a = auctions[o.auction_id];
                const u = users[o.winner_id];
                const ns = nextStatus(o);
                return (
                  <tr key={o.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{a?.title || "—"}</td>
                    <td className="px-4 py-3">{u ? (u.full_name || u.email) : `…${o.winner_id?.slice(-4)}`}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{o.method === "shipping" ? t.fulfilment.methodShip : t.fulfilment.methodPickup}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {o.method === "shipping" ? (
                        <span className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />{[o.address_name, o.address_line1, o.address_city, o.address_country].filter(Boolean).join(", ")}</span>
                      ) : (
                        <span>{o.pickup_notes || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-block text-xs font-semibold rounded-full px-2.5 py-1", STATUS_CLS[o.status])}>{t.fulfilment.status[o.status]}</span>
                      {o.carrier && <span className="block text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Truck className="w-3 h-3" />{o.carrier} {o.tracking_number}</span>}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {ns && <Button size="sm" onClick={() => openAdvance(o)}>{t.admin.fulfilment.advance.replace("{status}", t.fulfilment.status[ns])}</Button>}
                        {a && !a.paid && <Button size="sm" variant="outline" onClick={() => markPaid(o)}>{t.admin.fulfilment.markPaid}</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!advance} onOpenChange={(o) => !o && setAdvance(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t.admin.fulfilment.advance.replace("{status}", advance ? t.fulfilment.status[nextStatus(advance)] || "" : "")}</DialogTitle></DialogHeader>
          {advance && advance.method === "shipping" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t.admin.fulfilment.carrierPrompt}</Label>
                <Input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t.admin.fulfilment.trackingPrompt}</Label>
                <Input value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
            <Button onClick={confirmAdvance} disabled={busy}>{busy ? t.admin.saving : t.admin.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}