/**
 * Every TanStack Query key in the app, in one place.
 *
 * Keys are hierarchical so invalidation can target a whole domain
 * (`["auctions"]`) or one item. Some keys keep their legacy shape
 * (`["auction", id]`, `["bids", id]`, `["wallet", userId]`, `["myAuctions", userId]`)
 * because realtime handlers and other hooks already write to them.
 *
 * Reads whose result depends on who is signed in carry a `viewer`
 * (the user id, or "anon"), so a signed-out result is never served to a
 * signed-in user. The cache is also cleared on sign-in/out (AuthContext).
 */
const viewerOf = (v) => v || "anon";

export const auctionKeys = {
  all: ["auctions"],
  lists: () => ["auctions", "list"],
  list: (viewer, limit) => ["auctions", "list", viewerOf(viewer), limit],
  sync: () => ["auctions", "sync"],
  results: (id) => ["auctions", "results", id],
  // legacy shapes (written by realtime handlers)
  detail: (id) => ["auction", id],
  live: (id) => ["auctionSync", id],
  bidState: (id) => ["bidState", id],
  mine: (userId) => ["myAuctions", userId],
};

export const bidKeys = {
  byAuction: (auctionId) => ["bids", auctionId],
  summary: (viewer) => ["bids", "summary", viewerOf(viewer)],
  /** Newest bids across a set of live auctions (the /home activity feed). */
  recent: (viewer, auctionIds) => ["bids", "recent", viewerOf(viewer), auctionIds.join(",")],
};

export const chatKeys = {
  byAuction: (auctionId) => ["auctionChat", auctionId],
};

export const fulfilmentKeys = {
  claim: (auctionId, userId) => ["fulfilment", auctionId, userId],
  payment: (auctionId) => ["winnerPayment", auctionId],
  byToken: (token) => ["winnerPayment", "token", token],
};

export const walletKeys = {
  all: (userId) => ["wallet", userId],
  balance: (userId) => ["wallet", userId, "balance"],
  transactions: (userId) => ["wallet", userId, "transactions"],
  refunds: (userId) => ["wallet", userId, "refunds"],
};

export const notificationKeys = {
  unread: (userId) => ["notifications", userId, "unread"],
};

export const accountKeys = {
  me: () => ["account", "me"],
};

export const configKeys = {
  all: ["config"],
  settings: () => ["config", "settings"],
  content: () => ["config", "content"],
  categories: () => ["config", "categories"],
  paymentMethods: () => ["config", "paymentMethods"],
  publishedTheme: () => ["config", "theme", "published"],
  themeEditor: () => ["config", "theme", "editor"],
};

/** Staff-session data. Separate root so customer and admin caches never mix. */
export const adminKeys = {
  all: ["admin"],
  capabilities: () => ["admin", "capabilities"],
  entity: (entity) => ["admin-entity", entity],
  section: (section, ...rest) => ["admin", section, ...rest],
};
