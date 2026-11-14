import { useEffect, useState } from "react";
import { effectiveStatus, timeRemaining } from "@/lib/auction";

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
 */
export function useAuctionCountdown(auction) {
  const [remaining, setRemaining] = useState(() => timeRemaining(auction));

  useEffect(() => {
    setRemaining(timeRemaining(auction));
    if (effectiveStatus(auction) !== "live") return;
    const id = setInterval(() => setRemaining(timeRemaining(auction)), 1000);
    return () => clearInterval(id);
  }, [
    auction?.id,
    auction?.status,
    auction?.end_time,
    auction?.min_participants,
    auction?.max_subscribers,
    auction?.subscriber_ids,
  ]);

  return {
    status: effectiveStatus(auction),
    remaining,
    durationMinutes: Number(auction?.duration_minutes || 0),
  };
}
