import React, { useEffect, useState } from "react";
import { Truck, PackageCheck, MapPin, Clock, CheckCircle2, Receipt } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SHIPPING_STEPS = ["pending", "shipped", "delivered", "confirmed"];
const PICKUP_STEPS = ["pending", "ready", "collected", "confirmed"];

export default function WinnerClaim({ auction, user }) {
  const { t } = useI18n();
  const [f, setF] = useState(null);
  const [loadingF, setLoadingF] = useState(true);
  const [method, setMethod] = useState("shipping");
  const [addr, setAddr] = useState({ name: "", phone: "", line1: "", line2: "", city: "", country: "", zip: "" });
  const [pickupNotes, setPickupNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState(null);

  const load = () => {
    base44.entities.Fulfilment.filter({ auction_id: auction.id, winner_id: user.id }, "-created_date", 5)
      .then((rows) => setF(rows?.[0] || null))
      .finally(() => setLoadingF(false));
  };

  useEffect(() => {
    if (!auction?.id || !user?.id || auction.winner_id !== user.id) return;
    load();
    base44.functions
      .invoke("winnerPayment", { auction_id: auction.id })
      .then((res) => setPayment(res.data?.payment || null))
      .catch(() => {});
    return base44.entities.Fulfilment.subscribe(
      (ev) => {
        if (ev.data?.winner_id === user.id) load();
      },
      { filter: `auction_id=eq.${auction.id}`, onReconnect: load },
    );
  }, [auction?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auction || !user || auction.winner_id !== user.id) return null;
  if (loadingF) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const body = { auction_id: auction.id, method };
      if (method === "shipping") body.address = addr;
      else body.pickup_notes = pickupNotes;
      const res = await base44.functions.invoke("claimFulfilment", body);
      if (res.data?.error) { toast.error(res.data.error); return; }
      setF(res.data.fulfilment);
      toast.success(t.fulfilment.yourOrder);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const PaymentBanner = () => {
    if (!payment) return null;
    const paid = payment.status === "paid";
    return (
      <div className={cn("rounded-xl border p-4 space-y-1.5", paid ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
        <div className={cn("flex items-center gap-2 font-bold", paid ? "text-success" : "text-warning")}>
          <Receipt className="w-5 h-5" />
          {paid ? (t.pay?.paid || "Paid") : (t.pay?.amountDue || "Amount due")}: {t.common.currency}{Number(payment.amount || 0).toFixed(2)}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {paid
            ? (t.pay?.paidNote || "Your payment is confirmed. We will process your order.")
            : (t.pay?.manualHint || "Nothing was deducted from your wallet. Send your details and our team will contact you with the payment instructions.")}
        </p>
      </div>
    );
  };

  if (f) {
    const steps = f.method === "pickup" ? PICKUP_STEPS : SHIPPING_STEPS;
    const idx = Math.max(0, steps.indexOf(f.status));
    return (
      <div className="space-y-4">
      <PaymentBanner />
      <div className="native-panel rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-accent"><PackageCheck className="w-5 h-5" /> {t.fulfilment.yourOrder}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{t.fulfilment.sentNote}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t.fulfilment.method}:</span>
          <span className="font-semibold text-foreground">{f.method === "shipping" ? t.fulfilment.methodShip : t.fulfilment.methodPickup}</span>
        </div>
        {f.method === "shipping" && (f.address_line1 || f.address_city) && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 text-accent shrink-0" />
            <span>{[f.address_name, f.address_line1, f.address_line2, f.address_city, f.address_country, f.address_zip].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {f.method === "pickup" && f.pickup_notes && (
          <p className="text-sm text-muted-foreground">{f.pickup_notes}</p>
        )}
        {f.method === "shipping" && f.carrier && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="w-4 h-4 text-accent" /> {f.carrier}{f.tracking_number && ` · ${f.tracking_number}`}
          </div>
        )}
        <div className="flex items-center justify-between gap-1 pt-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={cn("w-7 h-7 rounded-full grid place-items-center text-xs", i <= idx ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                {i < idx ? <CheckCircle2 className="w-4 h-4" /> : i === idx ? <Clock className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn("text-[10px] text-center", i <= idx ? "text-foreground" : "text-muted-foreground")}>{t.fulfilment.status[s]}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    );
  }

  const inputCls = "w-full";

  return (
    <div className="space-y-4">
    <PaymentBanner />
    <div className="native-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 font-bold text-foreground"><PackageCheck className="w-5 h-5 text-accent" /> {t.fulfilment.claim}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t.fulfilment.manualNote}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setMethod("shipping")} className={cn("flex-1", method === "shipping" ? "border-accent bg-accent/10 text-accent" : "text-muted-foreground")}>
          {t.fulfilment.methodShip}
        </Button>
        <Button type="button" variant="outline" onClick={() => setMethod("pickup")} className={cn("flex-1", method === "pickup" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
          {t.fulfilment.methodPickup}
        </Button>
      </div>
      {method === "shipping" ? (
        <div className="grid grid-cols-2 gap-3">
          <Input className={inputCls} placeholder={t.fulfilment.name} value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} />
          <Input className={inputCls} placeholder={t.fulfilment.phone} value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
          <Input className={cn(inputCls, "col-span-2")} placeholder={t.fulfilment.line1} value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
          <Input className={cn(inputCls, "col-span-2")} placeholder={t.fulfilment.line2} value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
          <Input className={inputCls} placeholder={t.fulfilment.city} value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
          <Input className={inputCls} placeholder={t.fulfilment.country} value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} />
          <Input className={cn(inputCls, "col-span-2")} placeholder={t.fulfilment.zip} value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
        </div>
      ) : (
        <textarea className={cn(inputCls, "min-h-[80px] resize-none")} placeholder={t.fulfilment.pickupNotes} value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} />
      )}
      <Button onClick={submit} disabled={submitting} className="w-full font-bold">
        {submitting ? t.fulfilment.submitting : t.fulfilment.submit}
      </Button>
    </div>
    </div>
  );
}