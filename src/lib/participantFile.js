/**
 * Pure aggregation for the participant file (admin drill-down).
 * Takes the raw payload from getParticipantFile and derives per-auction
 * rollups, money totals, a running wallet balance and a unified timeline.
 */

const num = (v) => Number(v || 0);
const r2 = (v) => Math.round(num(v) * 100) / 100;

export const SPEND_TYPES = ["subscription", "bid_fee", "bid_credits", "winner_payment", "purchase"];

export function isSettled(tx) {
  return tx?.status !== "pending" && tx?.status !== "failed";
}

/** Wallet totals grouped by transaction type, plus balance and cash in/out. */
export function moneySummary(transactions = []) {
  const byType = {};
  let balance = 0;
  let inflow = 0;
  let outflow = 0;
  let pending = 0;

  for (const tx of transactions) {
    const amount = num(tx.amount);
    const type = tx.type || "other";
    if (!byType[type]) byType[type] = { type, count: 0, total: 0 };
    byType[type].count += 1;
    byType[type].total = r2(byType[type].total + amount);

    if (!isSettled(tx)) {
      pending = r2(pending + amount);
      continue;
    }
    balance = r2(balance + amount);
    if (amount >= 0) inflow = r2(inflow + amount);
    else outflow = r2(outflow + Math.abs(amount));
  }

  const spent = SPEND_TYPES.reduce((s, t) => s + Math.abs(num(byType[t]?.total)), 0);
  return {
    balance,
    inflow,
    outflow,
    pending,
    spent: r2(spent),
    byType: Object.values(byType).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  };
}

/** Wallet rows newest-first with the balance as it stood after each row. */
export function withRunningBalance(transactions = []) {
  const asc = [...transactions].sort(
    (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
  );
  let running = 0;
  const out = asc.map((tx) => {
    if (isSettled(tx)) running = r2(running + num(tx.amount));
    return { ...tx, running_balance: running };
  });
  return out.reverse();
}

/** One rollup per auction the participant took part in. */
export function auctionRollups(payload = {}) {
  const userId = payload.profile?.id;
  const bids = payload.bids || [];
  const peerBids = payload.peerBids || [];
  const txns = payload.transactions || [];
  const credits = payload.credits || [];

  const bidsByAuction = new Map();
  for (const b of bids) {
    if (!bidsByAuction.has(b.auction_id)) bidsByAuction.set(b.auction_id, []);
    bidsByAuction.get(b.auction_id).push(b);
  }
  const peerByAuction = new Map();
  for (const b of peerBids) {
    if (!peerByAuction.has(b.auction_id)) peerByAuction.set(b.auction_id, []);
    peerByAuction.get(b.auction_id).push(b);
  }

  return (payload.auctions || [])
    .map((a) => {
      const mine = (bidsByAuction.get(a.id) || []).sort(
        (x, y) => new Date(y.created_date).getTime() - new Date(x.created_date).getTime()
      );
      const live = mine.filter((b) => !b.archived);
      const active = live.filter((b) => !b.burned);
      const burned = mine.filter((b) => b.burned);
      const auctionTxns = txns.filter((t) => t.auction_id === a.id);
      const sumType = (type) =>
        r2(auctionTxns.filter((t) => t.type === type && isSettled(t)).reduce((s, t) => s + Math.abs(num(t.amount)), 0));

      const purchased = credits
        .filter((c) => c.auction_id === a.id)
        .reduce((s, c) => s + num(c.credits), 0);
      const quota = num(a.bids_per_participant) + purchased;

      const closest = a.mode === "closest";
      const target = num(a.target_price);
      let best = null;
      if (closest && active.length > 0) {
        best = active.reduce((acc, b) =>
          Math.abs(num(b.amount) - target) < Math.abs(num(acc.amount) - target) ? b : acc
        );
      } else if (!closest && live.length > 0) {
        best = live.reduce((acc, b) => (num(b.amount) > num(acc.amount) ? b : acc));
      }

      // Rank among the other seated participants (live round only).
      let rank = null;
      if (closest && best) {
        const perUser = new Map();
        for (const b of peerByAuction.get(a.id) || []) {
          if (b.archived || b.burned) continue;
          const gap = Math.abs(num(b.amount) - target);
          const prev = perUser.get(b.user_id);
          if (prev == null || gap < prev) perUser.set(b.user_id, gap);
        }
        const gaps = Array.from(perUser.entries()).sort((x, y) => x[1] - y[1]);
        const idx = gaps.findIndex(([uid]) => uid === userId);
        if (idx >= 0) rank = { position: idx + 1, of: gaps.length };
      }

      return {
        auction: a,
        seated: (a.subscriber_ids || []).map(String).includes(String(userId)),
        joinedAt: auctionTxns.find((t) => t.type === "subscription")?.created_date || null,
        bids: mine,
        liveBids: live,
        archivedBids: mine.filter((b) => b.archived),
        totalBids: mine.length,
        liveCount: live.length,
        burnedCount: burned.length,
        quota,
        purchasedCredits: purchased,
        entryFeePaid: sumType("subscription"),
        bidFeesPaid: sumType("bid_fee"),
        creditsPaid: sumType("bid_credits"),
        winnerCharged: sumType("winner_payment"),
        refunded: r2(auctionTxns.filter((t) => t.type === "refund" && isSettled(t)).reduce((s, t) => s + num(t.amount), 0)),
        bestAmount: best ? num(best.amount) : null,
        gap: closest && best ? r2(Math.abs(num(best.amount) - target)) : null,
        rank,
        won: String(a.winner_id || "") === String(userId),
      };
    })
    .sort((x, y) => {
      const xd = new Date(x.auction?.created_date || 0).getTime();
      const yd = new Date(y.auction?.created_date || 0).getTime();
      return yd - xd;
    });
}

/** Headline counters for the overview tab. */
export function activitySummary(payload = {}, rollups = []) {
  const bids = payload.bids || [];
  return {
    auctionsJoined: rollups.filter((r) => r.seated || r.totalBids > 0).length,
    auctionsWon: rollups.filter((r) => r.won).length,
    totalBids: bids.length,
    burnedNumbers: bids.filter((b) => b.burned).length,
    extraBidsBought: (payload.credits || []).reduce((s, c) => s + num(c.credits), 0),
    rejectedAttempts: (payload.events || []).filter((e) => e.outcome && e.outcome !== "success").length,
    lastActivity:
      [...(payload.events || []), ...bids, ...(payload.transactions || [])]
        .map((x) => x.created_date)
        .filter(Boolean)
        .sort()
        .pop() || null,
  };
}

/**
 * Unified chronological history: registration, bids, wallet moves, rejected
 * attempts, notifications, tickets, claims, refunds, notes and admin actions.
 */
export function buildTimeline(payload = {}) {
  const titleFor = (id) => (payload.auctions || []).find((a) => a.id === id)?.title || null;
  const items = [];
  const push = (kind, at, label, meta = {}) => {
    if (!at) return;
    items.push({ kind, at, label, ...meta });
  };

  if (payload.profile?.created_date) push("account", payload.profile.created_date, "registered");

  for (const b of payload.bids || []) {
    push("bid", b.created_date, b.burned ? "bid_burned" : "bid_placed", {
      amount: num(b.amount),
      auction_id: b.auction_id,
      auction: titleFor(b.auction_id),
      round: b.round,
      archived: !!b.archived,
    });
  }

  for (const tx of payload.transactions || []) {
    push("wallet", tx.created_date, tx.type || "wallet", {
      amount: num(tx.amount),
      status: tx.status,
      auction_id: tx.auction_id,
      auction: titleFor(tx.auction_id),
      description: tx.description || tx.notes || null,
    });
  }

  for (const e of payload.events || []) {
    if (e.outcome === "success") continue; // successes already appear as bids/joins
    push("attempt", e.created_date, e.reason || e.event || "rejected", {
      amount: e.amount != null ? num(e.amount) : null,
      auction_id: e.auction_id,
      auction: titleFor(e.auction_id),
      severity: e.severity,
      event: e.event,
    });
  }

  for (const n of payload.notifications || []) {
    push("notification", n.created_date, n.title || n.type || "notification", {
      channel: n.channel,
      status: n.status,
      description: n.body || null,
    });
  }
  for (const s of payload.tickets || []) {
    push("support", s.created_date, s.subject || "ticket", { status: s.status, description: s.body || null });
  }
  for (const f of payload.fulfilments || []) {
    push("fulfilment", f.created_date, f.method === "pickup" ? "pickup_request" : "shipping_request", {
      status: f.status,
      auction_id: f.auction_id,
      auction: titleFor(f.auction_id),
    });
  }
  for (const rr of payload.refunds || []) {
    push("refund", rr.created_date, "refund_request", { status: rr.status, description: rr.reason || null });
  }
  for (const nt of payload.notes || []) {
    push("note", nt.created_date, "staff_note", { description: nt.body, author: nt.author_name });
  }
  for (const l of payload.logs || []) {
    push("admin", l.created_date, l.action || "admin_action", { description: l.details || null, author: l.actor_name });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function toCsv(rows = [], columns = []) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label ?? c.key)).join(",");
  const body = rows.map((row) => columns.map((c) => esc(c.value ? c.value(row) : row[c.key])).join(","));
  return [head, ...body].join("\n");
}
