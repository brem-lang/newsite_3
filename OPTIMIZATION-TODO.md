# Performance Optimization Tracker

Source: `Optimization-Report.pdf` (19 Nov 2026, `main` @ `40b224e`). Section numbers (§) match the report.

Legend: ✅ done · ⏸️ deferred (not done, optional; pick up if traffic grows or something feels slow) · ➖ not applicable
Priority: 🔴 High · 🟠 Medium · 🟢 Low

## Status: CLOSED ✅ (19 Nov 2026)

Merged to `main` in PR #1, deployed, checked by the owner on the live site, and the wallet migration is applied on production.
The top 5 actions from the report are live. Remaining items are marked ⏸️ deferred and kept below for reference.

### If this is ever reopened (deferred items, in order of value)
1. ⏸️ Cache headers + compression in the server `.htaccess` (snippet under §3.10). ~5 min, returning visitors stop re-downloading files after each deploy
2. ⏸️ Compress `public/icon-512.png` and the other icons (§3.10). ~5 min
3. ⏸️ Auction page skeleton + prefetch on card hover/touch (§3.9). Feels faster to open
4. ⏸️ Fewer columns for lists, database tuning (§3.7, §4). Only if auctions get busy or Supabase usage climbs
5. ⏸️ Admin screens' realtime/timers, splitting the edge function (§3.1, §3.6, §3.11). Low impact

## Baseline vs now

| Metric | Baseline | Target | Now (live) |
|---|---|---|---|
| Main chunk `index-*.js` (gzip) | 227 KB (773 KB raw) | ≤ 120 KB | **161 KB** (556 KB raw) + React 59 KB and Radix 42 KB in separately cached chunks |
| framer-motion on first load | 42 KB (`useSwipe` chunk) | lazy | **lazy** (`motion-features` chunk, after first paint) |
| CSS (gzip) | 25 KB | | 23 KB |
| `public/icon-512.png` | 192 KB | < 40 KB | 192 KB (deferred) |
| Realtime messages per viewer per bid | every bid site-wide | only this auction | **only this auction** |
| Requests per bid per viewer | ~3 | 0–1 | **0 + 1 throttled** (`auctionBidState` max once per 1.5 s) |
| Wallet rows per poll | 200 every 20 s **per hook instance** | 1 | **1 RPC every 60 s, shared**, paused in hidden tabs |

---

## Week 1: Live data ✅

### 🔴 §3.1 Filter realtime subscriptions on the server
- [x] `subscribe(cb, { filter, onReconnect })` in `src/api/base44Client.ts`
- [x] One shared channel per `(area, table, filter)` with reference counting
- [x] `AuctionDetail`: bids `auction_id=eq.<id>`, auction `id=eq.<id>`
- [x] `useWallet`: `user_id=eq.<userId>`
- [x] `useBidAlerts`: only the user's joined auctions (`id=in.(…)`, max 100), list refreshed on join and on tab focus
- [x] Notifications (`user_id`), chat (`auction_id`), winner claim (`auction_id`) filtered too
- ⏸️ Admin screens (`AdminLive`, `AdminBidMonitor`, `AdminRevenueStream`) still listen to whole tables. Low impact (few admins), left as is

### 🔴 §3.2 Apply realtime payloads instead of re-fetching
- [x] `AuctionDetail`: bids merged into the cached list; auction fields merged (only fields the visitor's own read already has)
- [x] `auctionBidState` throttled to once per 1.5 s
- [x] Notifications, chat, content, currency apply the payload directly
- [x] Re-fetch only when a channel reconnects after a drop

### 🔴 §3.4 Wallet balance in Postgres
- [x] Migration `my_wallet_balance()`: sums the signed-in user's own rows (`auth.uid()`), no user-id argument so it can't read other wallets
- [x] `useWallet` fetches only the balance; transactions only on Wallet and Dashboard (`useWallet(id, true)`)
- [x] Migration applied on production

### 🔴 Duplicate loads
- [x] `AuctionDetail` no longer loads the auction twice on mount; `syncAuction` (every 15 s, skipped in hidden tabs) only triggers a reload when the server reports a status/end-time change

---

## Week 2: Fetching layer ✅ (core done; rest deferred)

### 🔴 §3.3 React Query
- [x] Wallet: one shared query for all 7 `useWallet` callers, 60 s safety poll, paused in background, refetch on focus
- [x] Auction and bids on the auction page (`["auction", id]`, `["bids", id]`)
- [x] Bid alerts' joined-auction list (`["myAuctions", userId]`)
- ⏸️ Notifications and site settings: still component state, but now on filtered/payload-applied streams, so the extra traffic is gone. Moving them is optional
- ⏸️ Remove the `cachedRead` layer in `base44Client.ts` once settings/themes/content are on React Query (still in use today)

### 🟠 §3.7 Select only needed columns
- [x] Added `filterFields()`; bid alerts use `listFields()` (6 columns instead of `*`)
- ⏸️ Auction cards / grids, bid lists, admin tables. Needs a per-component check of which fields are used; not done blind

---

## Week 3: Bundle and rendering ✅ (mostly)

### 🟠 §3.5 Split the main JS chunk
- [x] ➖ i18n split: **not applicable**. The site is English-only now, so there is one dictionary (~15 KB gzip) that every page needs
- [x] Vendor chunks: `vendor-react`, `vendor-radix` (`vite.config.ts`)
- ➖ `@supabase` and `@tanstack` stay in the entry chunk: Rolldown 1.2.1 ignores groups for them. Revisit after a Vite/Rolldown upgrade
- ⏸️ Check public routes don't import admin-only modules (bundle analysis with sourcemaps)

### 🟠 §3.6 Stop full-page re-renders every second
- [x] Shared clock `src/lib/useNow.js` (`useSyncExternalStore`), pauses when the tab is hidden
- [x] `AuctionDetail`: page re-renders only when the end time passes; the ring (`LiveCountdownRing`) ticks alone
- [x] Mobile auction room clock reads the clock itself
- [x] `MobileHome`, `LiveCarousel` → `<LiveCountdown/>` leaf; `FeaturedAuctionHero`, `MobileAuctionsHub`, `useAuctionCountdown` on the shared clock
- ⏸️ Admin: `AdminAuctions.jsx:34`, `AdminLive.jsx:81`, `NumberPoolPanel.jsx:103` still have their own 1 s timers (admin only)
- ⏸️ `BidPaceMeter.jsx:33` own 1 s timer (small component, low impact)

### 🟠 §3.8 Heavy libraries on customer pages
- [x] framer-motion → `LazyMotion` + `m.*`, features (`domMax`, needed for `layout` and `drag`) lazy-loaded from `src/lib/motion-features.js`
- [x] Recharts confirmed admin-only (lazy `AreaChart` chunk)
- [x] `canvas-confetti` loaded with `import()` at the moment of a win

---

## Week 4: Polish (partly done; rest deferred)

### 🟠 §3.9 Auction page loading and first paint
- [x] Removed the early `setLoading(false)`; the page waits for the auction query
- [x] `watched_auction_ids` read from the signed-in profile instead of another `auth.me()`
- ⏸️ Skeleton that matches the final layout (currently a spinner)
- ⏸️ Prefetch on hover/touch of an auction card (`queryClient.prefetchQuery(["auction", id])`, same key as the page uses)

### 🟢 §3.10 Images and static assets
- ⏸️ Compress `public/icon-512.png` (192 KB → < 40 KB), `icon-192.png`, `apple-touch-icon.png` (e.g. squoosh.app or `oxipng -o 4`)
- ⏸️ Auction images: Supabase Storage transforms (WebP/AVIF), `srcset`, `width`, `height`
- ⏸️ `fetchpriority="high"` on the hero/featured image only
- ⏸️ **Server (cPanel `.htaccess`, not in the repo):** add to the existing file next to the SPA rewrite rules:
  ```apache
  <IfModule mod_headers.c>
    <FilesMatch "^assets/">
      Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
  </IfModule>
  <IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
  </IfModule>
  ```
  (or `<Directory>`/`<LocationMatch "^/assets/">` if `FilesMatch` on paths isn't allowed by the host)

### 🟢 §3.11 Code hygiene
- [x] Removed 46 duplicate `.tsx` UI components (Vite always used the `.jsx` ones). CSS 170 → 162 KB
- [x] Removed unused `@hookform/resolvers`, `zod`, `date-fns`
- ⏸️ `embla-carousel-react`, `cmdk`, `react-resizable-panels`, `input-otp`, `vaul`, `react-day-picker`: imported by `src/components/ui/*` but those UI files may themselves be unused. Check with `npx knip`
- [x] One package manager: Bun (`bun.lock`); untracked `package-lock.json` deleted
- [x] `readBlocked()` / auctions source use an in-memory session flag instead of `getSession()` per read
- ⏸️ Split `supabase/functions/api/handlers.ts` (`placeBid`, `syncAuction`, `auctionBidState` as separate functions)

### 🟢 §4 Database and backend
- [x] ➖ `syncAuction` already returns early without writing when nothing is due (checked `ensureAuctionState`)
- ⏸️ `EXPLAIN ANALYZE` the bid list query; add `ON bids (auction_id, created_date DESC) WHERE archived = false` if needed
- ⏸️ RLS on `bids`, `auctions`, `wallet_transactions`: use `(select auth.uid())`, not bare `auth.uid()`
- ⏸️ Remove unused tables from `supabase_realtime` (e.g. check `bid_events`, `fulfilments` are still needed)
- ⏸️ Turn on `pg_stat_statements`, review top 10 queries after a busy auction

---

## Verification

- [x] **Bundle:** chunk sizes recorded above
- ⏸️ **CI:** size budget check (e.g. `size-limit`)
- ⏸️ **Network:** one auction in two browsers, 10 bids, count requests/websocket messages per bid
- ⏸️ **Rendering:** React DevTools Profiler, "Highlight updates" on the auction page: only the countdown should flash every second
- ⏸️ **Lighthouse (mobile):** `/`, `/auctions`, `/auction/:id`. Track LCP, INP, CLS
- ⏸️ **Database:** compare `pg_stat_statements` and Supabase Realtime usage before/after

| Phase | Done | Main chunk gzip | Requests/bid | LCP (`/auction/:id`) | Notes |
|---|---|---|---|---|---|
| Baseline | ✅ | 227 KB | ~3 | not measured | |
| Week 1 | ✅ | | 0 + 1 throttled | | filtered realtime, wallet RPC |
| Week 2 | ✅ | | | | wallet/auction on React Query |
| Week 3 | ✅ | 161 KB | | | + 59 KB React, 42 KB Radix cached separately |
| Week 4 | partial (rest deferred) | | | | |
