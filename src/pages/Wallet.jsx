import React, { useEffect, useState } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { useRefundRequests } from "@/lib/queries/wallet";
import { usePaymentMethods } from "@/lib/queries/config";
import { Wallet as WalletIcon, Plus, ArrowUpCircle, Ticket, CreditCard, Clock, CheckCircle2, XCircle, Loader2, Trophy, Receipt, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { useWallet } from "@/lib/useWallet";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RefundRequestDialog from "@/components/wallet/RefundRequestDialog";
import RefundRequestsList from "@/components/wallet/RefundRequestsList";
import BidSpendSummary from "@/components/wallet/BidSpendSummary";
import ReceiptModal from "@/components/wallet/ReceiptModal";
import MobileWallet from "@/components/wallet/MobileWallet";
import { useIsMobileView } from "@/lib/useIsMobileView";

const route = getRouteApi("/_app/wallet");
const EMPTY = [];

export default function Wallet() {
  const { t } = useI18n();
  const { symbol, code } = useCurrency();
  const { user } = useAuth();
  const { balance, transactions, loading, refresh } = useWallet(user?.id, true);
  const isMobile = useIsMobileView();
  const { session_id: sessionId, method_id: methodId } = route.useSearch();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(50);
  const { data: methods = EMPTY, isPending: methodsLoading } = usePaymentMethods();
  const [picked, setSelected] = useState(null);
  // Default to the first enabled method until the user picks one.
  const selected = picked ?? methods[0]?.id ?? null;
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refundTxn, setRefundTxn] = useState(null);
  const [receiptTxn, setReceiptTxn] = useState(null);
  const { data: refundReqs = EMPTY, refetch: refetchRefunds } = useRefundRequests(user?.id);

  const quickAmounts = [25, 50, 100, 250];

  // Handle return from a Stripe checkout redirect.
  useEffect(() => {
    if (!sessionId || !methodId || confirming) return;
    setConfirming(true);
    (async () => {
      try {
        const res = await base44.functions.invoke("topup", { action: "confirm", session_id: sessionId, method_id: methodId });
        if (res.data?.status === "confirmed") {
          toast.success(t.wallet.confirmedMsg);
          refresh();
        } else if (res.data?.status === "unpaid") {
          toast.error(t.wallet.failed || "Payment not completed");
        } else if (res.data?.error) {
          toast.error(res.data.error);
        }
      } catch (e) {
        toast.error(e.message || "Error");
      } finally {
        setConfirming(false);
        navigate({ to: "/wallet", search: {}, replace: true });
      }
    })();
  }, [sessionId, methodId, t.wallet.confirmedMsg, t.wallet.failed]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshRefunds = () => { refetchRefunds(); };
  const requestedIds = refundReqs.filter((r) => r.status === "pending").map((r) => r.original_transaction_id);

  // Lock page scroll while the no-scroll mobile wallet console is shown.
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    const prevH = html.style.overflow;
    const prevB = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevH;
      body.style.overflow = prevB;
    };
  }, [isMobile]);

  const selectedMethod = methods.find((m) => m.id === selected);
  const isLive = selectedMethod?.type === "live_gateway";
  const needsRef = selectedMethod?.type === "manual" || selectedMethod?.type === "transfer" || selectedMethod?.type === "cod";

  const handleTopUp = async () => {
    if (!user || amount <= 0) return;
    if (!selectedMethod) { toast.error(t.wallet.chooseMethod); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("topup", {
        action: "init",
        amount,
        payment_method_id: selected,
        reference,
        app_url: window.location.origin,
        currency: code
      });
      const data = res.data || {};
      if (data.error) { toast.error(data.error); return; }
      if (data.status === "redirect" && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.status === "pending") {
        toast.success(t.wallet.pendingMsg);
        setReference("");
      } else if (data.status === "confirmed") {
        toast.success(t.wallet.confirmedMsg);
      }
      refresh();
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isMobile) {
    return (
      <>
        {confirming && (
          <div className="fixed top-16 inset-x-0 z-50 px-4 py-3 bg-accent text-accent-foreground text-sm flex items-center gap-2 shadow-md">
            <Loader2 className="w-4 h-4 animate-spin" /> {t.wallet.confirming}
          </div>
        )}
        <MobileWallet
          user={user}
          balance={balance}
          transactions={transactions}
          loading={loading}
          methods={methods}
          methodsLoading={methodsLoading}
          selected={selected}
          setSelected={setSelected}
          amount={amount}
          setAmount={setAmount}
          reference={reference}
          setReference={setReference}
          onTopUp={handleTopUp}
          submitting={submitting}
          onReceipt={setReceiptTxn}
          onRefund={setRefundTxn}
          requestedIds={requestedIds}
          onRefresh={refresh}
        />
        <RefundRequestDialog transaction={refundTxn} open={!!refundTxn} onOpenChange={(o) => !o && setRefundTxn(null)} onSubmitted={refreshRefunds} />
        <ReceiptModal transaction={receiptTxn} open={!!receiptTxn} onOpenChange={(o) => !o && setReceiptTxn(null)} />
      </>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.wallet.title}</h1>
        <p className="text-muted-foreground">{t.wallet.subtitle}</p>
      </div>

      <div className="native-panel relative overflow-hidden rounded-xl border-primary/30 p-8 text-foreground">
        <div className="relative">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <WalletIcon className="w-4 h-4" />
            {t.wallet.balance}
          </div>
          {/* The route loader waits for the balance; nothing (not 0.00) until it's in. */}
          {!loading && (
            <p className="mt-3 font-heading text-5xl font-bold text-primary">
              {symbol}{balance.toFixed(2)}
            </p>
          )}
          <Link
            to="/deposit"
            className="cyan-button mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t.deposit.title}
          </Link>

        </div>
      </div>

      <BidSpendSummary transactions={transactions} />

      {confirming && (
        <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {t.wallet.confirming}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2 font-medium">
          <Plus className="w-4 h-4" />
          {t.wallet.topUp}
        </div>

        {methodsLoading ? null : methods.length === 0 ? (
          <div className="rounded-xl bg-muted/40 border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t.wallet.noMethods}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t.wallet.chooseMethod}</p>
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => {
                const active = selected === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:bg-secondary/60"
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    {m.name}
                  </button>
                );
              })}
            </div>

            {selectedMethod?.instructions && (
              <div className="rounded-xl bg-muted/30 border border-border p-4 text-sm text-muted-foreground whitespace-pre-line">
                {selectedMethod.instructions}
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-2">{t.wallet.quickAmounts}</p>
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amt) => (
                  <Button key={amt} variant={amount === amt ? "default" : "outline"} onClick={() => setAmount(amt)} className="px-5">
                    {symbol}{amt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Input type="number" min="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 h-11" />
              <Button onClick={handleTopUp} disabled={submitting || amount <= 0} className="px-6">
                {submitting ? (isLive ? t.wallet.redirecting : t.wallet.topping) : t.wallet.confirm}
              </Button>
            </div>

            {needsRef && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t.wallet.reference}</p>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t.wallet.referenceHint} className="h-11" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t.wallet.history}</h2>
        {loading ? null : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">{t.wallet.noHistory}</div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {transactions.map((txn) => {
              const isTopup = txn.type === "topup";
              const positive = (txn.amount || 0) >= 0;
              return (
                <div key={txn.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-full grid place-items-center shrink-0", isTopup ? "bg-success/10 text-success" : txn.type === "winning_bid" ? "bg-primary/10 text-primary" : txn.type === "refund" ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning")}>
                      {isTopup ? <ArrowUpCircle className="w-5 h-5" /> : txn.type === "winning_bid" ? <Trophy className="w-5 h-5" /> : txn.type === "refund" ? <RotateCcw className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {isTopup ? t.wallet.typeTopup : txn.type === "winning_bid" ? (t.wallet.typeWinning || t.auction.winner) : txn.type === "refund" ? t.wallet.typeRefund : t.wallet.typeSubscription}
                        <StatusTag status={txn.status} t={t} />
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(txn.created_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {txn.status === "confirmed" && (txn.type === "subscription" || txn.type === "winning_bid") && !requestedIds.includes(txn.id) && (
                        <Button size="sm" variant="outline" onClick={() => setRefundTxn(txn)} className="gap-1.5 px-2 sm:px-3"><RotateCcw className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t.refund.request}</span></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setReceiptTxn(txn)} className="gap-1.5 px-2 sm:px-3"><Receipt className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t.receipt.title}</span></Button>
                    </div>
                    <p className={cn("font-semibold", positive ? "text-success" : "text-foreground")}>
                      {positive ? "+" : ""}{symbol}{Math.abs(txn.amount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RefundRequestsList userId={user?.id} />

      <RefundRequestDialog transaction={refundTxn} open={!!refundTxn} onOpenChange={(o) => !o && setRefundTxn(null)} onSubmitted={refreshRefunds} />
      <ReceiptModal transaction={receiptTxn} open={!!receiptTxn} onOpenChange={(o) => !o && setReceiptTxn(null)} />
    </div>
  );
}

function StatusTag({ status, t }) {
  if (status === "confirmed") return <span className="inline-flex items-center gap-1 text-success text-[10px] font-semibold"><CheckCircle2 className="w-3 h-3" />{t.wallet.confirmed}</span>;
  if (status === "pending") return <span className="inline-flex items-center gap-1 text-warning text-[10px] font-semibold"><Clock className="w-3 h-3" />{t.wallet.pending}</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-destructive text-[10px] font-semibold"><XCircle className="w-3 h-3" />{t.wallet.failed}</span>;
  return null;
}

