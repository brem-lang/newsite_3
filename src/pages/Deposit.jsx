import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Wallet as WalletIcon, CreditCard, Building2, Banknote,
  CheckCircle2, Clock, Loader2, ShieldCheck,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/lib/useWallet";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const QUICK = [25, 50, 100, 250, 500, 1000];

function methodIcon(type) {
  if (type === "transfer") return Building2;
  if (type === "cod") return Banknote;
  return CreditCard;
}

/**
 * Standalone deposit flow: amount -> method -> review -> result.
 * Uses the existing `topup` server function (Stripe redirect for live
 * gateways, pending transaction for manual/transfer/cash methods).
 */
export default function Deposit() {
  const { t } = useI18n();
  const { symbol, code } = useCurrency();
  const { user } = useOutletContext() || {};
  const { balance, refresh } = useWallet(user?.id);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(50);
  const [methods, setMethods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { status, amount }

  useEffect(() => {
    base44.entities.PaymentMethod.filter({ enabled: true }, "display_order", 50)
      .then((rows) => {
        setMethods(rows || []);
        setSelected((prev) => prev || rows?.[0]?.id || null);
      })
      .catch(() => {});
  }, []);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === selected) || null,
    [methods, selected]
  );
  const needsRef =
    selectedMethod && ["manual", "transfer", "cod"].includes(selectedMethod.type);
  const isLive = selectedMethod?.type === "live_gateway";
  const numericAmount = Number(amount) || 0;
  const Back = ArrowLeft;

  const submit = async () => {
    if (!user) { navigate("/login"); return; }
    if (numericAmount <= 0) { toast.error(t.deposit.invalidAmount); return; }
    if (!selectedMethod) { toast.error(t.wallet.chooseMethod); return; }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("topup", {
        action: "init",
        amount: numericAmount,
        payment_method_id: selected,
        reference,
        app_url: window.location.origin,
        currency: code,
      });
      const data = res.data || {};
      if (data.error) { toast.error(data.error); return; }
      if (data.status === "redirect" && data.url) { window.location.href = data.url; return; }
      setResult({ status: data.status || "pending", amount: numericAmount });
      setStep(4);
      refresh();
      if (data.status === "confirmed") toast.success(t.wallet.confirmedMsg);
      else toast.success(t.wallet.pendingMsg);
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- result screen ---------------- */
  if (step === 4 && result) {
    const confirmed = result.status === "confirmed";
    return (
      <div className="mx-auto w-full max-w-md px-1 pb-8 pt-2">
       <div className="native-panel rounded-xl p-6 text-center">
          <span
            className={cn(
              "mx-auto grid h-16 w-16 place-items-center rounded-full",
              confirmed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            )}
          >
            {confirmed ? <CheckCircle2 className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
          </span>
          <h1 className="mt-4 font-heading text-xl font-bold">
            {confirmed ? t.deposit.doneTitle : t.deposit.pendingTitle}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {confirmed ? t.deposit.doneBody : t.deposit.pendingBody}
          </p>
          <p className="mt-5 font-display text-3xl font-extrabold tabular-nums">
            {symbol}{Number(result.amount).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedMethod?.name}</p>

          <div className="mt-6 grid gap-2">
            <Button className="h-12 rounded-2xl" onClick={() => navigate("/wallet")}>
              {t.deposit.viewWallet}
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl"
              onClick={() => { setResult(null); setStep(1); setReference(""); }}
            >
              {t.deposit.another}
            </Button>
            <Link to="/home" className="mt-1 text-sm font-semibold text-primary">
              {t.deposit.backHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-1 pb-10 pt-1">
      {/* header */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="iconSm"
          onClick={() => (step === 1 ? navigate("/wallet") : setStep(step - 1))}
          className="tap-44"
          aria-label={t.common.back || "Back"}
        >
          <Back className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-bold leading-tight">{t.deposit.title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {t.deposit.step} {step} / 3
          </p>
        </div>
         <div className="ms-auto rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-end">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.nav.balance}</p>
          <p className="text-sm font-bold tabular-nums">{symbol}{Number(balance || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* progress */}
      <div className="mb-5 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={cn("h-1.5 flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>

      {/* step 1 — amount */}
      {step === 1 && (
        <div className="space-y-5">
           <div className="native-panel rounded-xl p-5">
            <p className="text-sm font-semibold">{t.deposit.amountTitle}</p>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/50 px-4 py-3">
              <span className="font-display text-2xl font-extrabold text-muted-foreground">{symbol}</span>
              <Input
                type="number"
                min="1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 border-0 bg-transparent px-0 font-display text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {QUICK.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={Number(amount) === v ? "gold" : "outline"}
                  onClick={() => setAmount(v)}
                  className={cn(
                    "tap-44 px-2 text-sm tabular-nums"
                  )}
                >
                  {symbol}{v}
                </Button>
              ))}
            </div>
          </div>
          <Button
            className="h-13 w-full rounded-2xl py-4 text-base font-bold"
            disabled={numericAmount <= 0}
            onClick={() => setStep(2)}
          >
            {t.deposit.continue}
          </Button>
        </div>
      )}

      {/* step 2 — method */}
      {step === 2 && (
        <div className="space-y-5">
          {methods.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t.wallet.noMethods}
            </div>
          ) : (
            <div className="space-y-2">
              {methods.map((m) => {
                const Icon = methodIcon(m.type);
                const active = selected === m.id;
                return (
                  <Button
                    key={m.id}
                    type="button"
                    variant="outline"
                    onClick={() => setSelected(m.id)}
                    className={cn(
                      "h-auto w-full justify-start gap-3 p-4 text-start whitespace-normal",
                      active && "border-primary bg-primary/10 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.08)]"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{m.name}</span>
                      {m.instructions ? (
                        <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                          {m.instructions}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}
                    >
                      {active ? <CheckCircle2 className="h-4 w-4" /> : null}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}

          {needsRef && (
            <div className="rounded-[22px] border border-border bg-card p-4">
              <p className="text-sm font-semibold">{t.wallet.reference}</p>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t.wallet.referenceHint}
                className="mt-2 h-12 rounded-xl"
              />
            </div>
          )}

          <Button
            className="h-13 w-full rounded-2xl py-4 text-base font-bold"
            disabled={!selectedMethod}
            onClick={() => setStep(3)}
          >
            {t.deposit.continue}
          </Button>
        </div>
      )}

      {/* step 3 — review */}
      {step === 3 && (
        <div className="space-y-5">
           <div className="native-panel rounded-xl p-5">
            <p className="text-sm font-semibold">{t.deposit.reviewTitle}</p>
            <div className="mt-4 space-y-3 text-sm">
              <Row label={t.wallet.amount} value={`${symbol}${numericAmount.toFixed(2)}`} strong />
              <Row label={t.wallet.chooseMethod} value={selectedMethod?.name || "—"} />
              {reference ? <Row label={t.wallet.reference} value={reference} /> : null}
              <Row label={t.nav.balance} value={`${symbol}${Number(balance || 0).toFixed(2)}`} />
              <div className="h-px bg-border" />
              <Row
                label={t.deposit.newBalance}
                value={`${symbol}${(Number(balance || 0) + numericAmount).toFixed(2)}`}
                strong
              />
            </div>
            {selectedMethod?.instructions ? (
              <div className="mt-4 whitespace-pre-line rounded-2xl bg-secondary/50 p-4 text-[12px] leading-relaxed text-muted-foreground">
                {selectedMethod.instructions}
              </div>
            ) : null}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> {t.deposit.secure}
          </p>

          <Button
            className="h-13 w-full rounded-2xl py-4 text-base font-bold"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isLive ? t.wallet.redirecting : t.wallet.topping}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <WalletIcon className="h-4 w-4" />
                {t.deposit.confirmPay} {symbol}{numericAmount.toFixed(2)}
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-extrabold" : "font-semibold")}>{value}</span>
    </div>
  );
}
