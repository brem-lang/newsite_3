import { effectiveStatus, formatCountdownRing, timeRemaining } from "@/lib/auction";
import { useNow } from "@/lib/useNow";

/**
 * Countdown text for one auction. Reads the shared clock itself, so only this
 * text re-renders every second, not the list or card around it.
 */
export default function LiveCountdown({ auction, format = formatCountdownRing, fallback = null }) {
  const live = effectiveStatus(auction) === "live";
  const now = useNow(live);
  return live ? format(timeRemaining(auction, now)) : fallback;
}
