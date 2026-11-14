import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Trophy, Clock, CheckCircle2, XCircle, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Winner payment link: the winner is never charged from their wallet, so this
 * page shows what is owed and how to settle it manually with the team.
 */
export default function WinnerPayment() {
  const { token } = useParams();
  const { t } = useI18n();
  const [state, setState] = useState({ loading: true, error: null, payment: null, auction: null });

  useEffect(() => {
    let alive = true;
    base44.functions
      .invoke("winnerPayment", { token })
      .then((res) => {
        if (!alive) return;
        if (res.data?.error) setState({ loading: false, error: res.data.error, payment: null, auction: null });
        else setState({ loading: false, error: null, payment: res.data.payment, auction: res.data.auction });
      })
      .catch((e) => alive && setState({ loading: false, error: e.message || "Error", payment: null, auction: null }));
    return () => {
      alive = false;
    };
  }, [token]);

  if (state.loading) {
    return (
      <div className="h-64 grid place-items-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (state.error || !state.payment) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <XCircle className="w-10 h-10 mx-auto text-destructive" />
        <h1 className="font-heading text-xl font-bold">{t.pay?.notFound || "Payment link not found"}</h1>
        <p className="text-sm text-muted-foreground">
          {t.pay?.notFoundHint || "This payment link is invalid or belongs to another account."}
        </p>
        <Button asChild variant="outline">
          <Link to="/auctions">{t.nav?.auctions || "Auctions"}</Link>
        </Button>
      </div>
    );
  }

  const { payment, auction } = state;
  const paid = payment.status === "paid";
  const voided = payment.status === "void";

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <header className="text-center space-y-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/15 text-primary grid place-items-center border border-primary/30 shadow-[0_0_24px_hsl(var(--primary)/0.16)]">
          <Trophy className="w-7 h-7" />
        </div>
        <h1 className="font-heading text-2xl font-bold">{t.pay?.title || "Complete your payment"}</h1>
        <p className="text-sm text-muted-foreground">{auction?.title}</p>
      </header>

      <div className="native-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t.pay?.amountDue || "Amount due"}</span>
          <span className="font-heading text-2xl font-bold">{t.common.currency}{Number(payment.amount || 0).toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {paid ? (
            <span className="inline-flex items-center gap-1.5 text-success font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {t.pay?.paid || "Paid"}
            </span>
          ) : voided ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
              <XCircle className="w-4 h-4" />
              {t.pay?.void || "Cancelled"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-warning font-semibold">
              <Clock className="w-4 h-4" />
              {t.pay?.pending || "Awaiting payment"}
            </span>
          )}
        </div>

        {!paid && !voided && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.pay?.manualHint ||
              "Nothing was deducted from your wallet. Send your details and our team will contact you with the payment instructions and confirm your order."}
          </p>
        )}

        {paid && payment.paid_reference && (
          <p className="text-xs text-muted-foreground">
            {t.pay?.reference || "Reference"}: {payment.paid_reference}
          </p>
        )}

        {!paid && !voided && (
          <Button asChild className="w-full gap-2">
            <Link to={`/auction/${auction?.id || ""}`}>
              <Mail className="w-4 h-4" />
              {t.pay?.sendDetails || "Send your details"}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
