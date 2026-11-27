import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { auctionKeys } from "@/lib/queries/keys";
import { useI18n } from "@/lib/i18n";

const CLOSED = new Set(["ended", "voided", "voiding"]);
const FIELDS = "id, title, current_price, round, status, subscriber_ids";
// Supabase realtime accepts at most 100 values in an `in` filter.
const MAX_WATCHED = 100;

const snapshot = (a) => ({ title: a.title, price: Number(a.current_price) || 0, round: a.round || 1 });

/**
 * Live bid alerts for the auctions the signed-in user takes part in.
 * Fires a toast when the price/leader changes or a new round starts.
 *
 * Only those auctions are streamed (server-side `id=in.(…)` filter). The list
 * is re-read when the user joins an auction (AuctionDetail invalidates
 * ["myAuctions", userId]) and when the tab regains focus.
 */
export function useBidAlerts(user) {
  const { t, format } = useI18n();
  const tRef = useRef({ t, format });
  tRef.current = { t, format };
  const userId = user?.id;

  const { data: joined } = useQuery({
    queryKey: auctionKeys.mine(userId),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const list = await base44.entities.Auction.listFields(FIELDS, "-created_date", 200);
      return (list || []).filter((a) => !CLOSED.has(a.status) && (a.subscriber_ids || []).includes(userId));
    },
  });

  const mine = useRef(new Map()); // auctionId -> { title, price, round }
  const ids = (joined || []).map((a) => a.id).slice(0, MAX_WATCHED);
  const idsKey = ids.join(",");

  // Keep the last-seen snapshot for each joined auction, without dropping the
  // ones already tracked (their values may be newer than the list read).
  useEffect(() => {
    const next = new Map();
    for (const a of joined || []) next.set(a.id, mine.current.get(a.id) || snapshot(a));
    mine.current = next;
  }, [joined]);

  useEffect(() => {
    if (!userId || !idsKey) return;
    return base44.entities.Auction.subscribe(
      ({ data, event }) => {
        if (event !== "UPDATE" || !data?.id) return;
        const prev = mine.current.get(data.id);
        const stillIn = !data.subscriber_ids || data.subscriber_ids.includes(userId);
        if (!stillIn || CLOSED.has(data.status)) {
          mine.current.delete(data.id);
          return;
        }
        const next = {
          title: data.title ?? prev?.title,
          price: data.current_price !== undefined ? Number(data.current_price) || 0 : prev?.price ?? 0,
          round: data.round ?? prev?.round ?? 1,
        };
        mine.current.set(data.id, next);
        if (!prev) return;

        const { t: tr, format: fmt } = tRef.current;
        if (next.round > prev.round) {
          toast.info(tr.notifications.newRound, {
            description: fmt(tr.notifications.newRoundBody, { title: next.title, round: next.round }),
          });
        } else if (next.price !== prev.price) {
          toast.info(tr.notifications.bidChanged, {
            description: fmt(tr.notifications.bidChangedBody, {
              title: next.title,
              price: `₱${next.price.toFixed(2)}`,
            }),
          });
        }
      },
      { filter: `id=in.(${idsKey})` },
    );
  }, [userId, idsKey]);
}
