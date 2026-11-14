// Auction status helpers shared across pages.

/**
 * Seat target that closes a round (mirrors the backend closeQuota).
 * Reaching it is what allows a live round to settle when its timer expires.
 */
export function closeQuota(auction) {
  // Minimum target only — extra participants above it are always welcome.
  return Number(auction?.min_participants || 0) || Number(auction?.max_subscribers || 0);
}

export function seatsFull(auction) {
  const quota = closeQuota(auction);
  if (quota <= 0) return true;
  return (auction?.subscriber_ids || []).length >= quota;
}

export function effectiveStatus(auction, now = Date.now()) {
  if (!auction) return "open";
  if (auction.status === "ended") return "ended";
  if (auction.status === "live" && auction.end_time) {
    const expired = now >= new Date(auction.end_time).getTime();
    if (!expired) return "live";
    // Timer expired: only count as ended once seats are full. The backend
    // restarts the timer for another full duration when seats are still open,
    // so we must not flash "ended" here before that restart happens.
    return seatsFull(auction) ? "ended" : "live";
  }
  return auction.status || "open";
}

export function timeRemaining(auction, now = Date.now()) {
  if (!auction || !auction.end_time) return 0;
  return Math.max(0, new Date(auction.end_time).getTime() - now);
}

export function formatCountdown(ms) {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (d > 0) return `${String(d).padStart(2, "0")}:${hh}:${mm}:${ss}`;
  return h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Countdown for tight spaces (rings/badges). Long remainders read as
 * human units ("4 months 3 days", "2 days 6h") instead of a huge
 * 124:23:58:46 clock; under a day it falls back to hh:mm:ss.
 */
export function formatCountdownCompact(ms, t) {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total >= 86400) return formatDuration(Math.floor(total / 60), t);
  return formatCountdown(ms);
}

/**
 * Ultra-short countdown for circular badges where space is very tight.
 * >= 1 month: "2mo 5d" | >= 1 day: "14d 4h" | else hh:mm:ss / mm:ss.
 */
export function formatCountdownRing(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 1440) return formatCountdown(ms);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const mo = Math.floor(d / 30);
  if (mo >= 1) {
    const rd = d % 30;
    return rd > 0 ? `${mo}mo ${rd}d` : `${mo}mo`;
  }
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}


/**
 * Human-readable round length. Durations are stored in minutes but authored
 * and displayed in hours/days/months/years: 45 -> "45m", 180 -> "3h",
 * 1440 -> "1 day", 3000 -> "2 days 2h", 43200 -> "1 month",
 * 525600 -> "1 year", 800000 -> "1 year 6 months".
 */
export function formatDuration(minutes, t) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const labels = {
    minutes: t?.auction?.minutes || "min",
    hours: t?.auction?.hours || "h",
    day: t?.auction?.day || "day",
    days: t?.auction?.days || "days",
    month: t?.auction?.month || "month",
    months: t?.auction?.months || "months",
    year: t?.auction?.year || "year",
    years: t?.auction?.years || "years",
  };
  if (total === 0) return `0${labels.minutes}`;
  if (total < 60) return `${total}${labels.minutes}`;
  const MIN_DAY = 1440;
  const MIN_MONTH = 30 * MIN_DAY;
  const MIN_YEAR = 365 * MIN_DAY;
  const y = Math.floor(total / MIN_YEAR);
  const mo = Math.floor((total % MIN_YEAR) / MIN_MONTH);
  const d = Math.floor((total % MIN_MONTH) / MIN_DAY);
  const h = Math.floor((total % MIN_DAY) / 60);
  const m = total % 60;
  const parts = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? labels.year : labels.years}`);
  if (mo > 0) parts.push(`${mo} ${mo === 1 ? labels.month : labels.months}`);
  if (y === 0 && mo === 0 && d > 0) parts.push(`${d} ${d === 1 ? labels.day : labels.days}`);
  if (y === 0 && mo === 0 && h > 0) parts.push(`${h}${labels.hours}`);
  if (y === 0 && mo === 0 && d === 0 && m > 0) parts.push(`${m}${labels.minutes}`);
  return parts.join(" ");
}

/** Minutes -> hours for admin inputs (trims trailing zeros). */
export function minutesToHours(minutes) {
  const h = (Number(minutes) || 0) / 60;
  return Number(h.toFixed(4));
}

/** Hours -> minutes for storage. */
export function hoursToMinutes(hours) {
  return Math.max(1, Math.round((Number(hours) || 0) * 60));
}


export function isSubscribed(auction, userId) {
  return (auction?.subscriber_ids || []).includes(userId);
}
/* ---------------- sealed "closest to the price" mode ---------------- */

/** True when the auction is won by the unique number closest below the target. */
export function isClosestMode(auction) {
  return auction?.mode === "closest";
}

/**
 * The sealed number space is always cent-granular: every whole currency unit
 * holds exactly 100 numbers (x.01 … x+1.00). `bid_increment` only drives
 * ascending auctions, so it must never shrink the closest-price pool.
 */
export const NUMBER_STEP = 0.01;

/** Step users must respect when submitting a sealed number. */
export function sealedStep() {
  return NUMBER_STEP;
}

/** Rounds a number to the nearest valid two-decimal number. */
export function snapToStep(auction, amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return "";
  const cents = Math.max(1, Math.round(amt * 100));
  return (cents / 100).toFixed(2);
}

/**
 * Size of the number pool for a closest-price auction, in whole numbers:
 * target 1.00 -> 100 numbers, target 500 -> 50,000 numbers.
 */
export function totalNumbers(auction) {
  const target = Number(auction?.target_price || 0);
  if (!(target > 0)) return 0;
  return Math.round(target * 100);
}

/** Pool breakdown given how many distinct numbers are already taken. */
export function numberPool(auction, usedNumbers = 0) {
  const total = totalNumbers(auction);
  const used = Math.min(Math.max(Number(usedNumbers) || 0, 0), total);
  const free = Math.max(total - used, 0);
  return { total, used, free, freePct: total > 0 ? Math.round((free / total) * 100) : 0 };
}

/**
 * Validates a sealed number client-side (the database re-checks it).
 * Returns null when valid, otherwise an error code.
 */
export function validClosestAmount(auction, amount) {
  const amt = Number(amount);
  const target = Number(auction?.target_price || 0);
  if (!Number.isFinite(amt) || amt <= 0) return "errOutOfRange";
  if (target > 0 && amt > target) return "errOutOfRange";
  // Integer-cent math avoids float artefacts like 0.3 / 0.1 = 2.9999999.
  const cents = Math.round(amt * 100);
  if (Math.abs(amt * 100 - cents) > 1e-6) return "errBadStep";
  return null;
}



/**
 * Headline price for cards: sealed auctions advertise the selling price until
 * they end, then show the winning number.
 */
export function displayPrice(auction, status) {
  if (isClosestMode(auction) && status !== "ended") return Number(auction?.target_price || 0);
  return Number(auction?.current_price || 0);
}

/** i18n key for the headline price label. */
export function displayPriceKey(auction, status) {
  return isClosestMode(auction) && status !== "ended" ? "sealedTarget" : "currentPrice";
}
