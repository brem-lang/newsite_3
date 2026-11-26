import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import {
  useUnreadNotifications,
  useMarkAllRead,
  useMarkRead,
  notificationTarget,
  notificationBodyText,
  isPaymentTarget,
  payPathOf,
  useMyPaymentStatuses,
  useMyClaimedAuctionIds,
} from "@/lib/queries/notifications";
import { Bell, CheckCircle2, ChevronRight, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const NONE = [];

/** `buttonClassName` restyles the bell button (the mobile home header uses a round one). */
export default function NotificationBell({ buttonClassName }) {
  const { t, format } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // The signed-in profile is already resolved by AuthContext.
  const { user } = useAuth();
  const { data: items = NONE } = useUnreadNotifications(user?.id);
  const markAllRead = useMarkAllRead(user?.id);
  const markRead = useMarkRead(user?.id);
  // Win notifications carry a /pay/<token> link in their message; their
  // payment status decides whether the link is still offered.
  const hasPayLink = items.some((n) => payPathOf(n));
  const { data: paymentStatus = {} } = useMyPaymentStatuses(user?.id, hasPayLink);
  // Delivery details already sent: "Pay now" is dropped and it opens the order.
  const { data: claimed = null } = useMyClaimedAuctionIds(user?.id, hasPayLink);

  // Opening a notification marks it read and goes where it points
  // (the win notification opens the payment page).
  const openNotification = (n, target) => {
    setOpen(false);
    markRead.mutate(n);
    navigate({ to: target });
  };

  const markAll = () => markAllRead.mutate(items);

  if (!user) return null;
  const unread = items.length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} title={t.notifications.title} className={cn("relative border border-border/70 bg-card/70 text-accent", buttonClassName)}>
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="native-panel fixed sm:absolute inset-x-3 top-[68px] sm:inset-x-auto sm:top-auto sm:end-0 sm:mt-2 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl z-50 max-h-[70vh] sm:max-h-96 overflow-y-auto overflow-x-hidden text-start">

            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
              <span className="text-sm font-semibold">{t.notifications.title}</span>
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={markAll}>
                  {t.notifications.markAll}
                </Button>
              )}
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{t.notifications.empty}</div>
            ) : (
              items.map((n) => {
                const isOutbid = n.title === "OUTBID";
                const displayTitle = isOutbid ? t.notifications.outbid : n.title;
                const displayBody = isOutbid ? format(t.notifications.outbidBody, { title: n.body }) : notificationBodyText(n);
                const target = notificationTarget(n, paymentStatus, claimed);
                const pay = isPaymentTarget(target);
                const payInfo = payPathOf(n);
                const settled = !!payInfo && paymentStatus[payInfo.token] === "paid";
                const Row = target ? "button" : "div";
                return (
                  <Row
                    key={n.id}
                    {...(target ? { type: "button", onClick: () => openNotification(n, target) } : {})}
                    className={cn(
                      "block w-full text-start px-4 py-3 border-b border-border/60",
                      target && "cursor-pointer hover:bg-secondary/30 focus-visible:outline-none focus-visible:bg-secondary/40"
                    )}
                  >
                    <p className="text-sm font-medium break-words">{displayTitle}</p>
                    {displayBody && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 break-words">{displayBody}</p>}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground/70" dir="ltr">{formatDateTime(n.created_date)}</p>
                      {pay ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                          <CreditCard className="w-3 h-3" aria-hidden="true" /> {t.notifications.payNow}
                        </span>
                      ) : settled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> {t.notifications.paid}
                        </span>
                      ) : target ? (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
                      ) : null}
                    </div>
                  </Row>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}