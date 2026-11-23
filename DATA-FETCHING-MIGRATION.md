# TanStack Query + Router migration: progress tracker

Status as of 2026-11-21: **code migration complete. Not yet tested in a browser.** Nothing is committed; every change is in the working tree.
State: `npx tsc --noEmit` passes, `npm run build` passes, and the changed files lint clean apart from the repo-wide prettier formatting backlog.

## Done

### Phase 0: foundation
- `src/router.tsx`: QueryClient defaults (staleTime 30s, gcTime 5m, at most one retry and none on 4xx/not_found, no polling in background tabs), `defaultPreload: "intent"`, a default skeleton as the pending component (150ms delay, shown for at least 300ms).
- Deleted the unused `src/lib/query-client.js`.
- `src/lib/queries/`: `keys.js`, `config.js`, `auctions.js`, `wallet.js` (moved from `lib/useWallet.js`, which still re-exports it), `notifications.js`, `account.js`, `admin.js`, `live.js` (throttled invalidate-on-realtime helper).
- `src/components/skeletons/`: card, grid, list, stat, table, wallet, auction-detail, form, admin-section, page and app-shell skeletons.
- `src/lib/search.ts`: `validateSearch` parsers (auctions, wallet, returnTo, reset-password).
- Auth: the `_app` guard is now in `beforeLoad` (redirects to `/login?returnTo=…` and passes `userId` to loaders). `index` redirects signed-in users to `/home`. `AuthContext` clears user-scoped cache when the identity changes.
- Persisting the cache: **decided not to add a persister dependency.** Theme and currency already seed from localStorage, and config queries use `staleTime: Infinity` plus realtime (categories and payment methods: 10 min).
- `base44Client.ts` `cachedRead` was left in place. It can be removed once nothing reads config outside Query.

### Phases 1–2: customer site (all done)
- Config: `useContent`, currency, `SiteThemeLoader`, `useSiteTheme` (admin Design), AuthContext settings, MobileHome categories.
- Pages: Auctions (URL search params), Dashboard, Home, AuctionDetail (`useLiveAuction`, mutations, sync poll through `refetchInterval`), AuctionResults, Wallet, Deposit, Account, WinnerPayment.
- Components: AuctionChat, WinnerClaim, NotificationBell, RefundRequestsList, Layout, BottomNav, and all Link/navigate users (typed `to="/auction/$id" params=…`).
- Routes: loaders, pending skeletons and notFound on home, auctions, auction/$id, results, wallet, deposit, account, pay/$token, admin. validateSearch on auctions, wallet, login, register, reset-password.

### Phase 3: admin (done)
- AdminGate and Admin shell: cached capabilities query, typed links. Sidebar and command palette migrated.
- Shared lookups: `useAdminUserMap`, `useAdminAuctionMap`, `useAdminMe`, `adminUserListQuery`, `auctionBidsQuery`.
- Migrated panels: Analytics, Live (filtered bid stream), BidMonitor, RevenueStream, Auctions (+ AuctionBidsLog), NumberPoolPanel hook, Categories, Content, Coupons, Support, Verification, Notifications, Results, Broadcast, Fulfilment, Refunds, Hero, WinnerPayments, Roles, Users, Participants, System (counts now come from Postgres).

- Finished on 2026-11-21: AuctionPL (per-auction P&L cached), PaymentMethods (also refreshes the site payment-method/settings caches), Payments (Postgres-paginated pages cached, previous page kept while loading), Revenue, Settings (shared capability + staff profile queries), AuctionFinancePanel (history/rounds fetched per tab), ParticipantDetailDialog.
- No change needed: TestMode, EditUserDialog and PermissionsDialog only write data or fill in forms.
- All admin loading spinners replaced with skeletons; unused hook/base44 imports removed.

## Still open
1. **Browser check** (customer and admin): signed-out redirect and returnTo, Stripe return to `/wallet`, auction room bidding and realtime, polling stopping in hidden tabs, back/forward served from cache, admin sign-in/out and section switching, Payments pagination.
2. Optional: `ScrollToTop`, `PageNotFound` and `ProtectedRoute` (unused) still import the react-router shim. They work as they are.
3. Optional: remove `cachedRead` in `base44Client.ts`. Every config read now goes through Query, so it is a redundant second cache (harmless, at most 60s and cleared on writes/realtime).
