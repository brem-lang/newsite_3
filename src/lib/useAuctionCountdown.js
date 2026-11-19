import { effectiveStatus, timeRemaining } from "@/lib/auction";
import { useNow } from "@/lib/useNow";

/**
 * Ticking countdown for a single auction.
 *
 * Returns the rule-aware status (see effectiveStatus), the live ms remaining
 * (ticking once per second while the auction is live), and the configured
 * round length in minutes (only meaningful for open auctions).
 *
 * Cards use this to show a real-time countdown for live auctions, the
 * "Ended" label for ended ones, and the round length for open ones — instead
 * of always printing the raw duration_minutes.
 *
 * All cards share one clock (useNow), which pauses while the tab is hidden.
 */
export function useAuctionCountdown(auction) {
  const live = effectiveStatus(auction) === "live";
  const now = useNow(live);
  return {
    status: effectiveStatus(auction, now),
    remaining: timeRemaining(auction, now),
    durationMinutes: Number(auction?.duration_minutes || 0),
  };
}
