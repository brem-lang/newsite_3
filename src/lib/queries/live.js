import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribe to a table's realtime stream for as long as the component is
 * mounted, and invalidate `queryKey` when an event (or a reconnect) arrives.
 *
 * Events are coalesced: a burst of row changes produces one refetch per
 * `throttleMs` window, and concurrent invalidations share one request
 * (`cancelRefetch: false`). Use this for aggregates and admin tables where the
 * payload can't simply be merged into the cache.
 *
 *   useInvalidateOn(base44.entities.Bid, adminKeys.auctionBids(auctionId), { filter, throttleMs: 2000 })
 */
export function useInvalidateOn(entity, queryKey, { filter, throttleMs = 1000, enabled = true } = {}) {
  const qc = useQueryClient();
  const keyStr = JSON.stringify(queryKey);
  useEffect(() => {
    if (!enabled || !entity) return;
    const key = JSON.parse(keyStr);
    let timer = null;
    const refresh = () => qc.invalidateQueries({ queryKey: key }, { cancelRefetch: false });
    const soon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, throttleMs);
    };
    const unsub = entity.subscribe(soon, { filter, onReconnect: refresh });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [entity, keyStr, filter, throttleMs, enabled, qc]);
}
