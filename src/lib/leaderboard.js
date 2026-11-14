/**
 * Pure leaderboard model shared by the desktop/mobile auction views.
 *
 * Kept free of React so the masking rules (the closest-price numbers of other
 * participants must stay hidden while the round is live and are only revealed
 * once the auction ended) can be asserted by automated tests.
 */

/**
 * @param {object} opts
 * @param {Array}  opts.bids            raw bid rows
 * @param {string} opts.currentUserId   viewer id
 * @param {boolean} opts.live           round still running
 * @param {boolean} opts.closest        closest-price (sealed) auction
 * @param {number} opts.target          selling price for closest auctions
 * @param {number} [opts.limit]         max rows (default 5)
 */
export function buildLeaderboard({ bids, currentUserId, live, closest = false, target = 0, limit = 5 }) {
  const reveal = !live;
  const list = (bids || []).filter((b) => b && b.user_id && b.archived !== true);

  let ranked = [];
  if (closest) {
    const best = {};
    for (const b of list) {
      if (b.burned) continue;
      const amount = Number(b.amount || 0);
      const gap = Math.abs(Number(target || 0) - amount);
      if (!best[b.user_id] || gap < best[b.user_id].gap) best[b.user_id] = { userId: b.user_id, amount, gap };
    }
    ranked = Object.values(best).sort((a, b) => a.gap - b.gap);
  } else {
    const topByUser = {};
    for (const b of list) {
      const amount = Number(b.amount || 0);
      if (topByUser[b.user_id] == null || amount > topByUser[b.user_id]) topByUser[b.user_id] = amount;
    }
    ranked = Object.entries(topByUser)
      .map(([userId, amount]) => ({ userId, amount: Number(amount), gap: 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  const rows = ranked.slice(0, limit).map((r, i) => {
    const isYou = !!currentUserId && r.userId === currentUserId;
    // Every number is public now, live rounds included.
    return {
      userId: r.userId,
      rank: i + 1,
      isYou,
      masked: false,
      amount: r.amount,
      gap: r.gap,
    };
  });

  let streak = 0;
  for (const b of list) {
    if (b.user_id === currentUserId) streak++;
    else break;
  }

  return { rows, reveal, streak };
}

export default buildLeaderboard;
