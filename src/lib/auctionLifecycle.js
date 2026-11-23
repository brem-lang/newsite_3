// Admin side of the auction lifecycle (Auction_Lifecycle_Specification).
//
//   open -> live -> ended -> (Relaunch) open as the next round | archived
//                         \-> voided -> (Relaunch) open | archived
//
// Every status change runs a server action (supabase/functions/api/handlers.ts)
// that checks the move, applies it once (a second click gets 409) and writes
// the audit entry. The database refuses status writes from the browser.
import { base44 } from "@/api/base44Client";
import { effectiveStatus } from "@/lib/auction";

/** Status as staff see it: archived and voided stay distinct from ended. */
export function adminStatus(auction, now = Date.now()) {
  if (auction?.status === "archived" || auction?.status === "voided" || auction?.status === "voiding") return auction.status;
  return effectiveStatus(auction, now);
}

/** Moves allowed from each status, the current one first. */
const MOVES = {
  open: ["open", "live"],
  live: ["live", "ended"],
  ended: ["ended", "open", "archived"],
  voided: ["voided", "open", "archived"],
  voiding: ["voiding"],
  archived: ["archived"],
};
export const allowedStatuses = (status) => MOVES[status] || [status];

/** Server action for a move, or null when there is none. */
export function actionFor(from, to) {
  if (from === to) return null;
  if (from === "open" && to === "live") return "startAuction";
  if (from === "live" && to === "ended") return "closeAuction";
  if ((from === "ended" || from === "voided") && to === "open") return "relaunchAuction";
  if ((from === "ended" || from === "voided") && to === "archived") return "archiveAuction";
  return null;
}

/** Fields that cannot change while live (mirrors guard_auction_writes). */
export const LOCKED_WHILE_LIVE = [
  "start_price", "bid_increment", "duration_minutes", "max_subscribers", "min_participants",
  "entry_fee", "bid_fee", "extra_bid_price", "mode", "target_price", "bids_per_participant",
];

/** Only never-run auctions can be deleted; anything else is archived. */
export const canDelete = (a) => a?.status === "open" && !a?.start_time && Number(a?.round || 1) === 1;

export class LifecycleConflict extends Error {}

/** Runs one lifecycle action. Throws LifecycleConflict on 409, Error otherwise. */
export async function runLifecycle(action, auctionId) {
  const res = await base44.functions.invoke(action, { auction_id: auctionId });
  const error = res?.data?.error;
  if (res?.status === 409) throw new LifecycleConflict(error || "conflict");
  if (error || (res?.status || 200) >= 400) throw new Error(error || "Request failed");
  return res.data;
}
