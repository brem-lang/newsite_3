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
  /** Every bid of one auction (not just the live round). */
  byAuctionAll: (auctionId) => ["bids", auctionId, "all"],
  mine: (userId) => ["bids", "mine", userId],
  summaryAll: () => ["bids", "summary"],
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

export const supportKeys = {
  mine: (userId) => ["support", userId, "tickets"],
};

export const accountKeys = {
  me: () => ["account", "me"],
};

export const configKeys = {
  all: ["config"],
  settings: () => ["config", "settings"],
  content: () => ["config", "content"],
  pages: () => ["config", "pages"],
  categories: () => ["config", "categories"],
  brands: () => ["config", "brands"],
  paymentMethods: () => ["config", "paymentMethods"],
  publishedTheme: () => ["config", "theme", "published"],
  themeEditor: () => ["config", "theme", "editor"],
};

/**
 * Staff-session data. Separate roots (`["admin", …]`, `["admin-entity", …]`)
 * so customer and admin caches never mix.
 *
 * Every admin key is built here. Builders named `…All` (or called with no
 * argument) return a prefix for invalidation; the rest return one cache entry.
 * Paged tables put their params object last: `[...prefix, "page", params]`.
 */
const admin = (...parts) => ["admin", ...parts];

export const adminKeys = {
  all: admin(),
  capabilities: () => admin("capabilities"),
  me: () => admin("me"),

  // Generic CRUD tables (AdminCrudTable)
  entities: ["admin-entity"],
  entity: (entity) => ["admin-entity", entity],
  entityPage: (entity, params) => ["admin-entity", entity, "page", params],

  // Users / Participants / Verification (listUsers edge function)
  usersAll: () => admin("users"),
  usersList: () => admin("users", "list"),
  usersListPage: (params) => admin("users", "list", params),
  usersStatusCounts: (params) => admin("users", "list", "counts", params),
  usersLookup: () => admin("users", "lookup"),
  usersByIds: (...ids) => admin("users", "byIds", ...ids),
  participantFile: (userId) => admin("participant", userId),
  roles: () => admin("roles"),
  rolesList: () => admin("roles", "list"),

  // Auctions
  auctionsAll: () => admin("auctions"),
  auctionsActive: () => admin("auctions", "active"),
  auctionsAllPage: (params) => admin("auctions", "allPage", params),
  auctionsEnded: (...params) => admin("auctions", "ended", ...params),
  auctionsCounts: () => admin("auctions", "counts"),
  auctionsLookup: () => admin("auctions", "lookup"),
  auctionsByIds: (...ids) => admin("auctions", "byIds", ...ids),
  auctionBids: (...auctionId) => admin("auctionBids", ...auctionId),
  auctionHistory: (auctionId) => admin("auctionHistory", auctionId),
  numberPool: (auctionId) => admin("numberPool", auctionId),
  resultsAll: () => admin("results"),
  resultsPage: (params) => admin("results", "page", params),
  systemEvents: () => admin("systemEvents"),
  live: () => admin("live"),
  liveAuctions: () => admin("live", "auctions"),
  liveDetail: (...auctionId) => admin("live", "detail", ...auctionId),

  // Money
  paymentsAll: () => admin("payments"),
  paymentsSummary: () => admin("payments", "summary"),
  paymentsPage: (params) => admin("payments", "page", params),
  paymentsUserPicker: () => admin("payments", "userPicker"),
  refundsAll: () => admin("refunds"),
  refundsPage: (scope, params) => admin("refunds", scope, "page", params),
  refundTxnsByIds: (...ids) => admin("refunds", "txns", ...ids),
  revenueAll: () => admin("revenue"),
  revenueReport: (range) => admin("revenue", range),
  revenueStream: () => admin("revenue-stream"),
  auctionPLAll: () => admin("auctionpl"),
  auctionPLList: (params) => admin("auctionpl", "list", params),
  auctionPLDetail: (auctionId) => admin("auctionpl", "detail", auctionId),
  financeHistory: (auctionId) => admin("finance", "history", auctionId),
  financeRounds: (auctionId) => admin("finance", "rounds", auctionId),
  winnerPaymentsAll: () => admin("winnerpayments"),
  winnerPaymentsPage: (params) => admin("winnerpayments", "page", params),
  winnerPaymentsTotals: () => admin("winnerpayments", "totals"),
  winnerPaymentsByAuctions: (ids) => admin("winnerpayments", "byAuctions", ids),
  paymentMethods: () => admin("payment_methods"),

  // Operations
  analytics: (days) => admin("analytics", days),
  bidMonitorAll: () => admin("bidmonitor"),
  bidMonitorPage: (params) => admin("bidmonitor", "page", params),
  bidMonitorStats: () => admin("bidmonitor", "stats"),
  fulfilmentAll: () => admin("fulfilment"),
  fulfilmentPage: (params) => admin("fulfilment", "page", params),
  fulfilmentCounts: () => admin("fulfilment", "counts"),
  notificationsAll: () => admin("notifications"),
  notificationsPage: (params) => admin("notifications", "page", params),
  supportAll: () => admin("support"),
  supportPage: (params) => admin("support", "page", params),
  supportCounts: () => admin("support", "counts"),
  system: () => admin("system"),

  // Site content / config
  categories: () => admin("categories"),
  content: () => admin("content"),
  coupons: () => admin("coupons"),
  hero: () => admin("hero"),
  settings: () => admin("settings", "global"),
};
