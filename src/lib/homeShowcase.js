import { effectiveStatus } from "@/lib/auction";

/** How many auctions the home page showcase can hold. */
export const MAX_HOME_SLOTS = 6;

/**
 * Auctions shown on the home page, in the order the admin picked.
 * Ended/voided rounds never appear. When nothing is starred we fall back to
 * the newest still-running auctions so the home page is never empty.
 */
export function selectHomeAuctions(auctions, limit = MAX_HOME_SLOTS) {
  const running = (auctions || []).filter((a) => {
    const s = effectiveStatus(a);
    return s !== "ended" && a.status !== "voided" && a.status !== "voiding";
  });
  const featured = running
    .filter((a) => a.featured)
    .sort((a, b) => (a.featured_order || 0) - (b.featured_order || 0));
  const rest = running
    .filter((a) => !a.featured)
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  // Starred auctions come first, then the newest running ones fill the free slots.
  return [...featured, ...rest].slice(0, limit);
}
