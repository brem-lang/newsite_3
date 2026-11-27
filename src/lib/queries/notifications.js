import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { notificationKeys } from "./keys";

const visible = (n) => n && n.channel === "inapp" && !n.read && n.type !== "chat";

/**
 * Unread in-app notifications for the signed-in user. One cached query and
 * one user-filtered realtime channel, shared by every bell on the page; a slow
 * 60s safety poll (paused in background tabs) covers missed events.
 */
export function useUnreadNotifications(userId) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.unread(userId),
    queryFn: async () => {
      const list = await base44.entities.Notification.filter(
        { channel: "inapp", user_id: userId, read: false },
        "-created_date",
        20,
      );
      return (list || []).filter((n) => n.type !== "chat");
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId) return;
    const key = notificationKeys.unread(userId);
    // Each event carries the row: apply it directly, no re-fetch.
    return base44.entities.Notification.subscribe(
      (ev) => {
        const n = ev.data || {};
        qc.setQueryData(key, (list = []) => {
          const rest = list.filter((x) => x.id !== n.id);
          return ev.type !== "delete" && visible(n) ? [n, ...rest].slice(0, 20) : rest;
        });
      },
      { filter: `user_id=eq.${userId}`, onReconnect: () => qc.invalidateQueries({ queryKey: key }) },
    );
  }, [userId, qc]);

  return query;
}

/** Mark every listed notification read, optimistically clearing the bell. */
export function useMarkAllRead(userId) {
  const qc = useQueryClient();
  const key = notificationKeys.unread(userId);
  return useMutation({
    mutationFn: (items) =>
      Promise.all(items.map((n) => base44.entities.Notification.update(n.id, { read: true }).catch(() => {}))),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, []);
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.previous),
  });
}

/** Mark one notification read (when it is opened), dropping it from the bell. */
export function useMarkRead(userId) {
  const qc = useQueryClient();
  const key = notificationKeys.unread(userId);
  return useMutation({
    mutationFn: (n) => base44.entities.Notification.update(n.id, { read: true }),
    onMutate: async (n) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (list = []) => list.filter((x) => x.id !== n.id));
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.previous),
  });
}

const PAY_PATH = /\/pay\/([A-Za-z0-9]+)/;

/** The /pay/<token> path inside a win notification's message, or null. */
export const payPathOf = (n) => {
  const m = String(n?.body || "").match(PAY_PATH);
  return m ? { path: m[0], token: m[1] } : null;
};

/**
 * Status of the signed-in member's own payment requests, by token
 * ({ [token]: "pending" | "paid" | "void" }). Read only while the bell holds
 * a win notification, so the payment link can be switched off once paid.
 */
export function useMyPaymentStatuses(userId, enabled) {
  return useQuery({
    queryKey: ["winnerPayment", "mine", userId],
    queryFn: async () => {
      const rows = await base44.entities.WinnerPayment.filter({ user_id: userId }, "-created_date", 50);
      return Object.fromEntries((rows || []).map((r) => [r.token, r.status]));
    },
    enabled: !!userId && enabled,
    staleTime: 30_000,
  });
}

/**
 * Auctions the signed-in member has already sent delivery details for
 * (a fulfilment row exists). Read only while the bell holds a win notification.
 */
export function useMyClaimedAuctionIds(userId, enabled) {
  return useQuery({
    queryKey: ["fulfilment", "mine", userId],
    queryFn: async () => {
      const rows = await base44.entities.Fulfilment.filter({ winner_id: userId }, "-created_date", 50);
      return new Set((rows || []).map((r) => r.auction_id));
    },
    enabled: !!userId && enabled,
    staleTime: 30_000,
  });
}

/**
 * Where clicking a notification goes. A win notification opens its payment
 * page (/pay/<token> from the message) only while there is still something to
 * do there: the payment is due AND no delivery details were sent yet. (There
 * is no online payment; the page sends the winner to the delivery form, and
 * the team follows up with payment instructions.) After that it opens the
 * auction, where the order and payment status are shown; once paid or voided
 * it isn't a link at all. Other notifications about an auction open that
 * auction. Support replies open Help & support. null = not clickable.
 */
export function notificationTarget(n, paymentStatus = {}, claimed = null) {
  if (!n) return null;
  if (n.type === "support") return "/support";
  const pay = payPathOf(n);
  if (pay) {
    const status = paymentStatus[pay.token];
    if (status && status !== "pending") return null;
    if (claimed?.has(n.auction_id)) return n.auction_id ? `/auction/${n.auction_id}` : null;
    // Unknown status (still loading) counts as due: the payment page itself
    // shows "paid" if it already is.
    return pay.path;
  }
  return n.auction_id ? `/auction/${n.auction_id}` : null;
}

/** The message without the raw "Complete your payment here: /pay/…" path. */
export const notificationBodyText = (n) =>
  String(n?.body || "")
    .replace(/\s*Complete your payment here:\s*\/pay\/[A-Za-z0-9]+\.?/, "")
    .trim();

export const isPaymentTarget = (target) => !!target && target.startsWith("/pay/");
