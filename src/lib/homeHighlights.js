import { effectiveStatus, timeRemaining, isClosestMode } from "@/lib/auction";
import { selectHomeAuctions } from "@/lib/homeShowcase";

const HOUR = 60 * 60 * 1000;

const seatsOf = (a) => a?.subscriber_ids?.length || 0;
const seatsLeftOf = (a) => Math.max(0, Number(a?.max_subscribers || 0) - seatsOf(a));
const fillOf = (a) => seatsOf(a) / Math.max(1, Number(a?.max_subscribers || 0));
/**
 * Sort key for "ends first": the time left, with a run-out clock last. A live
 * auction at 0 whose seats aren't full is waiting for the server to restart
 * the round, so it isn't "ending" and must not lead a list with 00:00.
 */
export const endingKey = (a, now = Date.now()) => {
  const left = timeRemaining(a, now);
  return left > 0 ? left : Infinity;
};

const isRunning = (a) => {
  const s = effectiveStatus(a);
  return s !== "ended" && a.status !== "voided" && a.status !== "voiding";
};

/**
 * Everything the /home screens use to pull people in, derived only from real
 * auction rows and the user's own wallet/seats (no invented numbers):
 *
 * - spotlight: the one auction to lead with (admin's featured pick first, else
 *   a live one ending soonest, else the fullest open one)
 * - fillingFast: open auctions closest to full (they go live when full)
 * - pulse: live count, live auctions ending within the hour, seats taken in
 *   live auctions
 * - nextStep: the single most useful action for this user right now
 */
export function homeHighlights(auctions = [], { userId = null, balance = 0, now = Date.now() } = {}) {
  const running = auctions.filter(isRunning);
  const live = running.filter((a) => effectiveStatus(a, now) === "live");
  const open = running.filter((a) => effectiveStatus(a, now) === "open");

  const showcase = selectHomeAuctions(auctions);
  const endingFirst = [...live].sort((a, b) => endingKey(a, now) - endingKey(b, now));
  const fullestOpen = open.filter((a) => seatsLeftOf(a) > 0).sort((a, b) => fillOf(b) - fillOf(a));

  const spotlight = showcase.find((a) => a.featured) || endingFirst[0] || fullestOpen[0] || showcase[0] || null;

  const fillingFast = fullestOpen.filter((a) => a.id !== spotlight?.id && seatsOf(a) > 0).slice(0, 4);

  const pulse = {
    live: live.length,
    endingWithinHour: live.filter((a) => timeRemaining(a, now) > 0 && timeRemaining(a, now) <= HOUR).length,
    seatsInPlay: live.reduce((n, a) => n + seatsOf(a), 0),
  };

  const mineRunning = userId ? running.filter((a) => (a.subscriber_ids || []).includes(userId)) : [];
  const mineLive = mineRunning.filter((a) => effectiveStatus(a, now) === "live");
  const joinable = open.filter((a) => seatsLeftOf(a) > 0 && !(a.subscriber_ids || []).includes(userId));
  const fees = joinable.map((a) => Number(a.entry_fee || 0)).filter((f) => f > 0);
  const cheapestEntry = fees.length ? Math.min(...fees) : 0;
  const affordable = joinable.filter((a) => Number(a.entry_fee || 0) <= Number(balance || 0)).length;

  let nextStep = null;
  if (userId) {
    if (mineLive.length > 0) {
      nextStep = { kind: "bidNow", auction: [...mineLive].sort((a, b) => endingKey(a, now) - endingKey(b, now))[0], count: mineLive.length };
    } else if (mineRunning.length > 0) {
      nextStep = { kind: "waiting", auction: mineRunning[0], count: mineRunning.length, seatsLeft: seatsLeftOf(mineRunning[0]) };
    } else if (joinable.length > 0 && cheapestEntry > 0 && Number(balance || 0) < cheapestEntry) {
      nextStep = { kind: "deposit", cheapestEntry, count: joinable.length };
    } else if (affordable > 0) {
      nextStep = { kind: "join", count: affordable, auction: fullestOpen.find((a) => joinable.includes(a)) || joinable[0] };
    }
  }

  return { spotlight, fillingFast, pulse, nextStep, live, open };
}

/**
 * Auctions whose bids may appear in the /home activity feed: live ones with
 * public bids (sealed "closest" auctions keep their numbers secret). Sorted,
 * so the feed's cache key and realtime filter don't change with list order.
 */
export const feedAuctionIds = (auctions = []) =>
  auctions
    .filter((a) => isRunning(a) && effectiveStatus(a) === "live" && !isClosestMode(a))
    .map((a) => a.id)
    .sort()
    .slice(0, 50);

/** "{count} seats left" + { count: 3 } -> "3 seats left". */
export const fill = (str, vars) =>
  Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), str || "");

export { seatsOf, seatsLeftOf, fillOf };
