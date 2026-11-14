import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  Wallet as WalletIcon, Plus, ArrowUpCircle, Ticket, CreditCard,
  Clock, CheckCircle2, XCircle, Trophy, RotateCcw, Receipt, ChevronRight, ChevronDown, Hash, Info
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import PullToRefresh from "@/components/PullToRefresh";
import BidSpendSummary from "@/components/wallet/BidSpendSummary";

const noScroll = "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]";

const TYPE_META = (t) => ({
  topup: { label: t.wallet.typeTopup, icon: ArrowUpCircle, cls: "bg-success/10 text-success" },
  winning_bid: { label: t.wallet.typeWinning, icon: Trophy, cls: "bg-accent/10 text-accent" },
  refund: { label: t.wallet.typeRefund, icon: RotateCcw, cls: "bg-accent/10 text-accent" },
  subscription: { label: t.wallet.typeSubscription, icon: Ticket, cls: "bg-primary/10 text-primary" },
  adjustment: { label: t.wallet.typeTopup, icon: Plus, cls: "bg-muted text-muted-foreground" }
});

export default function MobileWallet({
  user, balance, transactions, loading, methods, selected, setSelected,
  amount, setAmount, reference, setReference, onTopUp, submitting,
  onReceipt, onRefund, requestedIds, onRefresh
}) {
  const { t, dir } = useI18n();
  const { symbol, code } = useCurrency();
  const arrowCls = "";
  const L = (o) => (o.en);
  const quickAmounts = [25, 50, 100, 250];
  const selectedMethod = methods.find((m) => m.id === selected);
  const needsRef = selectedMethod && ["manual", "transfer", "cod"].includes(selectedMethod.type);
  const [topOpen, setTopOpen] = useState(false);

  // Group transactions newest-first by day for a clean, readable log.
  const groups = useMemo(() => {
    const sorted = [...(transactions || [])].sort(
      (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );
    const out = [];
    for (const txn of sorted) {
      const d = new Date(txn.created_date);
      const key = isNaN(d) ? "—" : d.toDateString();
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(txn);
      else out.push({ key, date: d, items: [txn] });
    }
    return out;
  }, [transactions]);

  const dayLabel = (d) => {
    if (isNaN(d)) return "—";
    const today = new Date();
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="app-shell page-transition z-10 flex flex-col overflow-hidden bg-background" dir={dir}>
      <PullToRefresh
        onRefresh={onRefresh}
        className={cn("flex-1 min-h-0 overscroll-contain pb-6", noScroll)}
        innerClassName="min-h-full"
      >
        {/* Screen 11 header */}
        <div className="px-4 pt-4">
          <h1 className="font-display text-[22px] font-extrabold text-foreground">{t.wallet.myWallet}</h1>
        </div>

        {/* Balance hero */}
        <div className="mx-4 mt-3">
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 text-foreground shadow-[0_0_36px_-22px_hsl(var(--primary)/0.9)]">
            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground">{t.wallet.balance}</p>
                <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-display text-[34px] leading-none font-extrabold tracking-tight tabular-nums break-all text-primary">
                    {Number(balance || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[12px] font-bold text-primary/70">{code}</span>
                </div>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-primary" aria-hidden="true">
                <WalletIcon className="h-6 w-6" />
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="mt-3 grid grid-cols-4 gap-2 px-4">
          <Link
            to="/deposit"
            className="native-panel flex h-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold text-foreground active:scale-95"
          >
            <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
            {t.wallet.actDeposit}
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTopOpen((v) => !v)}
            className="native-panel flex h-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold text-foreground active:scale-95"
          >
            <ArrowUpCircle className="h-4 w-4 text-accent" aria-hidden="true" />
            {t.wallet.topUp}
          </Button>
          <Link
            to="/auctions?tab=mine"
            className="native-panel flex h-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold text-foreground active:scale-95"
          >
            <Ticket className="h-4 w-4 text-accent" aria-hidden="true" />
            {t.wallet.actMyBids}
          </Link>
          <a
            href="#wallet-history"
            className="native-panel flex h-[62px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold text-foreground active:scale-95"
          >
            <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
            {t.wallet.actStatement}
          </a>
        </div>


        {/* Top-up panel — opens from the quick action above */}
        {topOpen && (
        <div className="native-panel mx-4 mt-3 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="text-[13px] font-bold text-foreground">{t.wallet.topUp}</p>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setTopOpen(false)} aria-label={t.common?.close || "Close"} className="rounded-full">
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          </div>

          {true && (
            <div id="topup-panel" className="px-3 pb-3 border-t border-border pt-3">
              {methods.length === 0 ? (
                <div className="rounded-xl bg-muted/60 border border-border p-3 flex gap-2">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{t.wallet.noMethods}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{t.wallet.amount}</p>
                    <div className={cn("flex gap-1.5 overflow-x-auto pb-1", noScroll)}>
                      {quickAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={amount === amt ? "cyan" : "outline"}
                          size="sm"
                          aria-pressed={amount === amt}
                          onClick={() => setAmount(amt)}
                          className={cn(
                            "min-h-9 shrink-0 px-4 text-[12px]",
                            amount !== amt && "bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {symbol}{amt}
                        </Button>
                      ))}
                    </div>
                    <div className="relative mt-2">
                      <span className="absolute top-1/2 -translate-y-1/2 start-3 text-[13px] font-bold text-muted-foreground">{symbol}</span>
                      <Input
                        type="number" min="1" value={amount}
                        aria-label={t.wallet.amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="h-11 text-center text-base font-extrabold bg-muted/60 border-border"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{t.wallet.chooseMethod}</p>
                    <div className={cn("flex gap-1.5 overflow-x-auto pb-1", noScroll)}>
                      {methods.map((m) => {
                        const active = selected === m.id;
                        return (
                          <Button
                            key={m.id}
                            type="button"
                            variant={active ? "cyan" : "outline"}
                            size="sm"
                            aria-pressed={active}
                            onClick={() => setSelected(m.id)}
                            className={cn(
                              "min-h-10 shrink-0 gap-1.5 px-3 text-[12px]",
                              !active && "text-muted-foreground"
                            )}
                          >
                            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" /> {m.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {needsRef && (
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-2.5" aria-hidden="true" />
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={t.wallet.referenceHint}
                        aria-label={t.wallet.referenceHint}
                        className="h-10 text-[12px] bg-muted/60 border-border ps-8"
                      />
                    </div>
                  )}

                  <Button
                    onClick={onTopUp}
                    disabled={submitting || amount <= 0}
                    className="w-full h-11 text-[13px] font-bold gap-1.5"
                  >
                    {submitting ? t.wallet.topping : (
                      <span className="flex items-center gap-1">
                        {t.wallet.confirm} · {symbol}{Number(amount || 0).toFixed(0)}
                        <ChevronRight className={cn("w-4 h-4", arrowCls)} aria-hidden="true" />
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <div className="px-4 pt-4">
          <BidSpendSummary transactions={transactions} compact />
        </div>

        {/* History header */}
        <div id="wallet-history" className="flex items-center justify-between px-4 pt-4 pb-1.5 scroll-mt-4">
          <h2 className="font-display text-[15px] font-extrabold text-foreground">{t.wallet.recent}</h2>
          <span className="text-[10px] font-semibold text-muted-foreground bg-border/70 rounded-full px-2 py-0.5 tabular-nums">
            {transactions.length}
          </span>
        </div>

        {/* Transaction log */}
        <div className="px-4" aria-live="polite" aria-busy={loading ? "true" : "false"}>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-card animate-pulse border border-border" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-3xl bg-card border border-border py-10 text-center" role="status">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border grid place-items-center mx-auto mb-3" aria-hidden="true">
                <Receipt className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-[14px] font-bold text-foreground">{t.wallet.noHistory}</p>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-[240px] mx-auto">
                {"Your top-ups, entries and refunds will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <section key={g.key}>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                    {dayLabel(g.date)}
                  </h3>
                   <ul className="rounded-xl bg-card border border-border shadow-sm divide-y divide-border overflow-hidden">
                    {g.items.map((txn) => {
                      const meta = TYPE_META(t)[txn.type] || TYPE_META(t).adjustment;
                      const Icon = meta.icon;
                      const positive = (txn.amount || 0) >= 0;
                      const canRefund =
                        txn.status === "confirmed" &&
                        (txn.type === "subscription" || txn.type === "winning_bid") &&
                        !requestedIds.includes(txn.id);
                      return (
                        <li key={txn.id} className="p-3">
                          <div className="flex items-center gap-2.5">
                            <span className={cn("w-9 h-9 rounded-xl grid place-items-center shrink-0", meta.cls)} aria-hidden="true">
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-bold text-foreground truncate">{meta.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="tabular-nums">
                                  {new Date(txn.created_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <StatusTag status={txn.status} t={t} />
                              </p>
                            </div>
                            <p className={cn(
                              "shrink-0 font-display text-[15px] font-extrabold leading-none tabular-nums",
                              positive ? "text-success" : "text-foreground"
                            )}>
                              {positive ? "+" : "−"}{symbol}{Math.abs(txn.amount || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {canRefund && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => onRefund(txn)}
                                className="h-8 px-2.5 text-[11px] gap-1 rounded-lg"
                              >
                                <RotateCcw className="w-3 h-3" aria-hidden="true" /> {t.refund.request}
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => onReceipt(txn)}
                              className="h-8 px-2.5 text-[11px] gap-1 rounded-lg ms-auto text-muted-foreground"
                            >
                              <Receipt className="w-3 h-3" aria-hidden="true" /> {t.receipt.title}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
             </div>
           )}
         </div>
      </PullToRefresh>
    </div>
  );
}

function StatusTag({ status, t }) {
  if (status === "confirmed") return <span className="inline-flex items-center gap-0.5 text-success text-[9.5px] font-semibold"><CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />{t.wallet.confirmed}</span>;
  if (status === "pending") return <span className="inline-flex items-center gap-0.5 text-primary text-[9.5px] font-semibold"><Clock className="w-2.5 h-2.5" aria-hidden="true" />{t.wallet.pending}</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-0.5 text-destructive text-[9.5px] font-semibold"><XCircle className="w-2.5 h-2.5" aria-hidden="true" />{t.wallet.failed}</span>;
  return null;
}
