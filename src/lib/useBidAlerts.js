import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";

const CLOSED = new Set(["ended", "voided", "voiding"]);

/**
 * Live bid alerts for the auctions the signed-in user takes part in.
 * Fires a toast when the price/leader changes or a new round starts.
 */
export function useBidAlerts(user) {
  const { t, format } = useI18n();
  const mine = useRef(new Map()); // auctionId -> { title, price, round }
  const tRef = useRef({ t, format });
  tRef.current = { t, format };

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    const seed = async () => {
      try {
        const list = await base44.entities.Auction.list("-created_date", 200);
        if (!alive) return;
        mine.current = new Map(
          (list || [])
            .filter((a) => !CLOSED.has(a.status) && (a.subscriber_ids || []).includes(user.id))
            .map((a) => [a.id, { title: a.title, price: Number(a.current_price) || 0, round: a.round || 1 }])
        );
      } catch {
        /* ignore */
      }
    };
    seed();

    const unsub = base44.entities.Auction.subscribe(({ data, event }) => {
      if (event !== "UPDATE" || !data?.id) return;
      const joined = (data.subscriber_ids || []).includes(user.id);
      const prev = mine.current.get(data.id);
      if (!joined || CLOSED.has(data.status)) {
        mine.current.delete(data.id);
        return;
      }
      const next = { title: data.title, price: Number(data.current_price) || 0, round: data.round || 1 };
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
            price: `$${next.price.toFixed(2)}`,
          }),
        });
      }
    });

    return () => {
      alive = false;
      unsub?.();
    };
  }, [user?.id]);
}
