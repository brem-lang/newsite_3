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
