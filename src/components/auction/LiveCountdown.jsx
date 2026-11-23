import { effectiveStatus, formatCountdownRing, timeRemaining } from "@/lib/auction";
import { useNow } from "@/lib/useNow";
import { useI18n } from "@/lib/i18n";

/**
 * Countdown text for one auction. Reads the shared clock itself, so only this
 * text re-renders every second, not the list or card around it.
 *
 * Two states never show a frozen clock:
 * - the timer ran out but the seats aren't full: the server restarts the
 *   round, so it reads "New round" until the new end time arrives;
 * - the auction ended while on screen: "Ended" (not the `fallback`, which is
 *   meant for auctions that haven't started).
 */
export default function LiveCountdown({ auction, format = formatCountdownRing, fallback = null }) {
  const { t } = useI18n();
  const status = effectiveStatus(auction);
  const live = status === "live";
  const now = useNow(live);
  if (status === "ended") return t.auction.statusEnded;
  if (!live) return fallback;
  const left = timeRemaining(auction, now);
  return left > 0 ? format(left) : t.auction.newRound;
}
