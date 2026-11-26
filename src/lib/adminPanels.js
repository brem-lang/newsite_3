import { DEFAULT_SECTION } from "@/lib/adminNav";

/**
 * Code-split admin panels: opening /admin doesn't download all the screens.
 * Shared by the page (src/pages/Admin.jsx renders them with lazy()) and the
 * /admin and /admin/$section route loaders, which download the panel's code and
 * its data before the navigation finishes (see loadPanel below), so the top
 * progress bar covers it instead of a skeleton.
 */
export const PANEL_IMPORTS = {
  analytics: () => import("@/components/admin/AdminAnalytics"),
  live: () => import("@/components/admin/AdminLive"),
  auctions: () => import("@/components/admin/AdminAuctions"),
  results: () => import("@/components/admin/AdminResults"),
  fulfilment: () => import("@/components/admin/AdminFulfilment"),
  categories: () => import("@/components/admin/AdminCategories"),
  brands: () => import("@/components/admin/AdminBrands"),
  winnerpayments: () => import("@/components/admin/AdminWinnerPayments"),
  auctionpl: () => import("@/components/admin/AdminAuctionPL"),
  revenue: () => import("@/components/admin/AdminRevenue"),
  payments: () => import("@/components/admin/AdminPayments"),
  payment_methods: () => import("@/components/admin/AdminPaymentMethods"),
  refunds: () => import("@/components/admin/AdminRefunds"),
  coupons: () => import("@/components/admin/AdminCoupons"),
  users: () => import("@/components/admin/AdminUsers"),
  participants: () => import("@/components/admin/AdminParticipants"),
  verification: () => import("@/components/admin/AdminVerification"),
  roles: () => import("@/components/admin/AdminRoles"),
  hero: () => import("@/components/admin/AdminHero"),
  pages: () => import("@/components/admin/AdminPages"),
  design: () => import("@/components/admin/AdminDesign"),
  broadcast: () => import("@/components/admin/AdminBroadcast"),
  notifications: () => import("@/components/admin/AdminNotifications"),
  templates: () => import("@/components/admin/AdminTemplates"),
  support: () => import("@/components/admin/AdminSupport"),
  system: () => import("@/components/admin/AdminSystem"),
  bidmonitor: () => import("@/components/admin/AdminBidMonitor"),
  activitylog: () => import("@/components/admin/AdminActivityLogs"),
  apikeys: () => import("@/components/admin/AdminApiKeys"),
  reports: () => import("@/components/admin/AdminReports"),
  testmode: () => import("@/components/admin/AdminTestMode"),
  settings: () => import("@/components/admin/AdminSettings"),
  shipping: () => import("@/components/admin/AdminShipping"),
};

/** Download a section's code. The browser caches the module and lazy() reuses
 *  it on render. Never rejects; safe to call repeatedly (hover, route loader). */
export const preloadPanel = (id) => (PANEL_IMPORTS[id]?.() ?? Promise.resolve()).catch(() => {});

/**
 * Route loader for a section: its code and, for a signed-in staff member, the
 * data it paints first (each panel's exported `prefetch(queryClient)`).
 * The current panel stays on screen under the progress bar until this
 * resolves. Never rejects; a failed read is shown by the panel itself.
 */
export async function loadPanel(id, queryClient, isStaff) {
  const section = PANEL_IMPORTS[id] ? id : DEFAULT_SECTION;
  const mod = await PANEL_IMPORTS[section]().catch(() => null);
  if (isStaff && typeof mod?.prefetch === "function") await mod.prefetch(queryClient);
}
