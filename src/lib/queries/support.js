import { useEffect } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { supportKeys } from "./keys";

/**
 * A member's own support tickets (one message + one staff reply each).
 * The database fills in the member's name/email and forces status "open" on
 * insert (support_ticket_member_guard), so the client only sends the message.
 */
export const supportQueries = {
  mine: (userId) =>
    queryOptions({
      queryKey: supportKeys.mine(userId),
      queryFn: async () =>
        (await base44.entities.SupportTicket.filter({ user_id: userId }, "-created_date", 50)) || [],
      enabled: !!userId,
      staleTime: 30_000,
    }),
};

/** The member's tickets, kept live by a user-filtered realtime channel (staff replies). */
export function useMyTickets(userId) {
  const qc = useQueryClient();
  const query = useQuery(supportQueries.mine(userId));

  useEffect(() => {
    if (!userId) return;
    const key = supportKeys.mine(userId);
    return base44.entities.SupportTicket.subscribe(
      (ev) => {
        const row = ev.data || {};
        if (!row.id) return;
        qc.setQueryData(key, (list) => {
          if (!list) return list;
          const rest = list.filter((x) => x.id !== row.id);
          if (ev.type === "delete") return rest;
          const existing = list.find((x) => x.id === row.id);
          return existing ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...rest];
        });
      },
      { filter: `user_id=eq.${userId}`, onReconnect: () => qc.invalidateQueries({ queryKey: key }) },
    );
  }, [userId, qc]);

  return query;
}

/** Friendly text for the guard's errors (see the migration). */
export function supportErrorMessage(error, t) {
  const msg = String(error?.message || "");
  const s = t?.supportCenter || {};
  if (msg.includes("support_rate_limited")) return s.rateLimited || "You've sent several tickets in the last hour. Please wait a little before sending another.";
  if (msg.includes("support_subject_invalid")) return s.subjectInvalid || "Please add a subject (up to 150 characters).";
  if (msg.includes("support_body_invalid")) return s.bodyInvalid || "Please describe your issue (up to 5000 characters).";
  return msg || "Error";
}

/** Open a ticket: { subject, body, category, auction_id? }. */
export function useCreateTicket(userId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subject, body, category, auction_id }) =>
      base44.entities.SupportTicket.create({
        user_id: userId,
        subject: subject.trim(),
        body: body.trim(),
        category,
        auction_id: auction_id || null,
      }),
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(supportKeys.mine(userId), (list = []) => [row, ...list.filter((x) => x.id !== row.id)]);
      qc.invalidateQueries({ queryKey: supportKeys.mine(userId) });
    },
  });
}
