import React from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { auctionQueries, useFulfilment } from "@/lib/queries/auctions";
import { useAuth } from "@/lib/AuthContext";
import { Trophy, Clock, CheckCircle2, XCircle, Mail, PackageCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Winner payment link: the winner is never charged from their wallet, so this
 * page shows what is owed and how to settle it manually with the team.
 */
const route = getRouteApi("/_app/pay/$token");

export default function WinnerPayment() {
  const { token } = route.useParams();
  const { t } = useI18n();
  const { data, isPending, error } = useQuery(auctionQueries.paymentByToken(token));
  const state = { error: error?.message || null, payment: data?.payment || null, auction: data?.auction || null };
  // Delivery details already sent? Then there is nothing left to do here
  // but wait for the team's payment instructions.
  const { user } = useAuth();
  const { data: fulfilment = null } = useFulfilment(state.auction?.id, user?.id, !!state.auction?.id && !!user?.id);

  // The route loader waits for the payment (success or error) first.
  if (isPending) return null;

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
            {fulfilment
              ? (t.pay?.detailsReceivedHint ||
                "We have your delivery details. Our team will contact you with the payment instructions; your item ships (or is ready for pickup) once your payment is received.")
              : (t.pay?.manualHint ||
                "Nothing was deducted from your wallet. Send your details and our team will contact you with the payment instructions and confirm your order.")}
          </p>
        )}

        {paid && payment.paid_reference && (
          <p className="text-xs text-muted-foreground">
            {t.pay?.reference || "Reference"}: {payment.paid_reference}
          </p>
        )}

        {!paid && !voided && (
          <Button asChild variant={fulfilment ? "outline" : "default"} className="w-full gap-2">
            <Link to="/auction/$id" params={{ id: auction?.id || "" }}>
              {fulfilment ? <PackageCheck className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              {fulfilment ? (t.pay?.viewOrder || "View your order") : (t.pay?.sendDetails || "Send your details")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
