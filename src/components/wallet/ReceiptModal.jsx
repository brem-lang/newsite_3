import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

const TYPE_LABEL = (t) => ({
  topup: t.wallet.typeTopup,
  subscription: t.wallet.typeSubscription,
  winning_bid: t.wallet.typeWinning || t.auction.winner,
  refund: t.wallet.typeRefund,
  adjustment: "Adjustment"
});

export default function ReceiptModal({ transaction, open, onOpenChange }) {
  const { t } = useI18n();
  const { symbol } = useCurrency();
  if (!transaction) return null;

  const labels = TYPE_LABEL(t);
  const date = new Date(transaction.created_date).toLocaleString("en-GB");
  const amount = Math.abs(transaction.amount || 0);
  const sign = (transaction.amount || 0) >= 0 ? "+" : "-";

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    const html = [
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + t.receipt.title + "</title>",
      "<style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:18px;margin:0}.sub{color:#666;font-size:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd;font-size:14px}.label{color:#666}.amt{font-weight:bold}.brand{color:#16a34a;font-weight:800;margin-bottom:4px}</style></head><body>",
      "<div class='brand'>" + (t.receipt.title || "Mazady") + "</div>",
      "<h1>" + t.receipt.desc + "</h1><div class='sub'>" + date + "</div>",
      "<div class='row'><span class='label'>" + t.receipt.type + "</span><span>" + labels[transaction.type] + "</span></div>",
      "<div class='row'><span class='label'>" + t.receipt.amount + "</span><span class='amt'>" + sign + symbol + amount.toFixed(2) + "</span></div>",
      transaction.provider ? "<div class='row'><span class='label'>" + t.receipt.method + "</span><span>" + transaction.provider + "</span></div>" : "",
      transaction.reference ? "<div class='row'><span class='label'>" + t.receipt.reference + "</span><span>" + transaction.reference + "</span></div>" : "",
      "<div class='row'><span class='label'>" + t.receipt.date + "</span><span>" + date + "</span></div>",
      "</body></html>"
    ].join("");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t.receipt.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
            <span className="text-xs font-bold tracking-wide text-primary uppercase">{t.receipt.title}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
          <Row label={t.receipt.type} value={labels[transaction.type]} />
          <Row label={t.receipt.amount} value={`${sign}${symbol}${amount.toFixed(2)}`} strong />
          {transaction.provider && <Row label={t.receipt.method} value={transaction.provider} />}
          {transaction.reference && <Row label={t.receipt.reference} value={transaction.reference} />}
          <Row label={t.receipt.date} value={date} />
          {transaction.description && <Row label={t.receipt.desc} value={transaction.description} />}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">{t.admin.cancel}</Button></DialogClose>
          <Button onClick={print} className="gap-2">{t.receipt.print}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-dashed border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}