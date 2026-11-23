# Session notes: 2026-11-21

Everything below is **uncommitted** (same working tree as the TanStack migration in
`DATA-FETCHING-MIGRATION.md`). Builds pass (`npx vite build`). **Nothing here has
been checked in a browser yet.**

---

## Done

### 1. `.gitignore`
- `.agents\skills\design-taste-frontend` (Windows backslashes, never matched) →
  `.agents/skills/design-taste-frontend/`. Verified with `git check-ignore`.

### 2. Loading screen on refresh
- **Cause:** the static SPA shell (`dist/client/_shell.html`) contained the default
  route skeleton (title + auction cards), so every hard refresh flashed auction cards.
- `AppShellSkeleton` (`src/components/skeletons/PageSkeleton.jsx`) is now a neutral
  brand splash (gavel logo + pulsing dots) instead of a fake header + auction grid.
- Used while the session / staff check runs: `/_app` (`src/routes/_app.tsx`),
  `/` (`src/routes/index.tsx`), `/admin` + `/admin/$section`, `AdminGate.jsx`,
  `pages/Admin.jsx` (`!caps`). Page-shaped skeletons stay on the child routes and
  inside the admin layout (section `Suspense` fallback).

### 3. Slow route / tab changes
- Removed the 260ms slide-in on every navigation: `<main>` in
  `src/components/Layout.jsx` (kept `key={pathname}`) and the mobile tab screens
  (`MobileAccount`, `MobileAuctionsHub`, `MobileWallet`). Kept on `MobileAuctionDetail`.
- `src/router.tsx`: `defaultPendingMs` 150 → 300, `defaultPendingMinMs` 300 → 200;
  `refetchOnWindowFocus` default **off**. Opted back in: wallet (already),
  auction detail, bid state, round bids, auction clock sync (`src/lib/queries/auctions.js`).
- Admin sections preload their code on hover/focus/touch of sidebar + section-tab
  links (`PANEL_IMPORTS` / `preloadPanel` in `pages/Admin.jsx`, `onPreload` prop on
  `AdminSidebar`).
- Not changed: the dev server is slower on first visit per page (normal);
  `useSyncAuctions` still calls `syncAuctions` + refetches lists every 30s on list pages.

### 4. Images (`src/components/ui/image.jsx`)
- **Stretching fixed:** Supabase-storage (non-Wix) URLs took the plain `<img>` path
  without `object-fit`; now `object-cover` (fill) / `object-contain` (fit).
- **Placeholder:** the Wix stock "no image" graphic was replaced with an inline,
  theme-neutral SVG picture icon (missing `image_url` or a broken image).
- A follow-up (skeleton pulse while a photo downloads + hero empty-state changes)
  was **undone** at the user's request.

### 5. Home hero headline (`src/components/home/SiteHero.jsx`, `pages/Home.jsx`)
- "Bid up, win smart." is the i18n default for `hero_title`. The hero now shows
  pulsing bars while site content (`useContent`) loads; the default text only
  shows if the loaded content has no `hero_title` / `hero_subtitle`.

### 6. Admin auction status (`AdminAuctions.jsx`, `AuctionFormDialog.jsx`, `i18n.jsx`)
- **UNDONE (2026-11-21, user request):** everything below was reverted. The status
  dropdown, the form's status select and the original handleStatusChange are back;
  Restart round, the badge and the restart i18n keys are gone. Don't redo it.
  Separately, `ui/alert-dialog.jsx` animations were removed (plain confirm box).
- Status column is a **read-only badge** (Open for entry / Live now / Ended /
  Cancelled). The dropdown is gone.
- Actions: **Start now** (open) · **Restart round** + **End now** (live).
  Restart = fresh full duration, keeps seats/bids, increments `restart_count`
  (counts toward `max_restarts`), confirm text shows "restart N of M".
- Removed "back to Open for entry" (with seats taken the server re-starts it
  immediately, an uncounted hidden restart).
- Edit form: status is display-only and never saved; new auctions are always `open`.
  (Previously "Ended" from the form changed the label without settling a winner.)
- "Cancelled" label is hard-coded English (only `en` exists in i18n).

### 7. Dialogs / modals
- framer-motion modals: `ui/bottom-sheet.jsx` and the winner-claim sheet in
  `MobileAuctionDetail.jsx`. Everything else is Radix + CSS animation.
- `ui/dialog.jsx`: `DialogContent` now splits children into **fixed header ·
  scrolling body · fixed footer** (`splitDialogChildren`; enters `DialogForm` or
  any `display: contents` wrapper like the participant dialog's `Tabs`).
  Verified with a Node render test; **not verified in a browser.**
- `ui/alert-dialog.jsx`: only the description scrolls; title + buttons fixed.
- `ui/bottom-sheet.jsx`: drag-to-dismiss only from the handle/title bar
  (`useDragControls`); framer's vertical drag was blocking touch scrolling of the
  content. Height cap `88vh` → `88dvh`.
- Claim sheet content: `min-h-0 flex-1 overscroll-contain`.

---

## Open / unresolved

- **Dialog header/footer report:** the user says the header/footer still don't stay
  put and the whole dialog scrolls. Unresolved: need which dialog + whether it's
  the dev server / a stale tab / the deployed site. Known gap: Account dialogs
  (Edit profile, Change password, Security) and `ParticipantDetailDialog` have **no
  `DialogFooter`**. Their Save buttons live inside the content and scroll with it.
- **Browser test** everything above (hard refresh `/`, `/wallet`, `/admin` signed
  in/out; tab switching on mobile; admin section switching; long admin form dialog;
  bid sheet scroll + drag).

## Decisions pending (offered, not done)

- **Reopen an ended auction:** DONE 2026-11-23, see SESSION-NOTES-2026-11-23-lifecycle.md (relaunch as next round, auto-reopen removed). Options were:
  1. **Relist** (recommended): duplicate into a new auction via the create form;
     keeps winner/payment/results/P&L of the ended one. Front-end only.
  2. **Reopen as next round** on the same row: new server action; wipes the row's
     winner fields, and results/payments are keyed by auction id → multi-round risk.
  - Also asked: turn off the **automatic reopen** (`reopenLastEndedIfAllEnded`,
    `supabase/functions/api/handlers.ts:1539`). When every auction is ended/voided
    it silently reopens the latest ended one on the same row.
- **Desktop hero shows voided/ended auctions:** `SiteHero` falls back to the full
  list when nothing is featured; should use `selectHomeAuctions` like the cards.
- **Hot-linked images:** "iPhone 17 Pro Max" (voided) uses an `estorejo.com` image
  URL, "iPhone 18 Pro" (voided) uses `leaders.jo`. Suggested: upload to own storage;
  warn on pasted external URLs in `ImagePicker`.
- **Image uploads** (`ImagePicker.jsx`): suggested size hint (landscape ≥1200×900,
  centred), client-side resize to ~1600px WebP, soft warning for small/portrait,
  optionally require an image on create.
- **Auction flow:** an open auction goes live on the first join or schedule, and
  entry stays open while live (by design). Offered: close entry once live / wait for
  a full room / add a draft stage. Each needs server changes.
- Account dialogs: move Save buttons into a real `DialogFooter` so they stay fixed.

---

## Later: one loading state per page (progress bar)

Plan: `~/.claude/plans/effervescent-toasting-cookie-*.md`. Done, build passes, **not browser-tested**.
- `src/components/RouteProgressBar.jsx` (mounted in `__root.tsx`): top bar while the router is pending, 150ms delay.
- `router.tsx`: `defaultPendingMs: Infinity` keeps the current page on screen during navigation;
  `defaultPendingComponent: FirstLoadPending` (fixed full-screen brand splash) only renders on first load.
  Per-route skeleton pendingComponents removed (wallet, auctions, auction, results).
- User route loaders now `await Promise.all(ensureQueryData…)` for everything the page paints
  (home, auctions, wallet, deposit, account, auction, results, pay, public `/`).
  Optional extras (bidState, winnerPayment, content, pay token) are `.catch(() => null)`.
- Page skeletons → `null`; empty states gated on pending (Wallet methods/balance, Dashboard + Auctions
  include bid summary in `loading`, results/auction room wait for bids via `bidsPending`).
  `useWallet().loading` now includes the balance.
- Admin (lighter pass): panel imports moved to `src/lib/adminPanels.js`; `/admin` and `/admin/$section`
  loaders download the panel code, Suspense fallback is `null`; each panel keeps one TableSkeleton.
  Fixed early empties: AdminLive, AdminRevenueStream, AuctionFinancePanel history, LiveAuctionMonitor.

### Admin: data prefetched too (no more panel skeletons)
- Every admin panel exports `prefetch(queryClient)`; `loadPanel()` in `src/lib/adminPanels.js` runs it from the
  `/admin` and `/admin/$section` loaders (after the staff check). Switching sections keeps the current panel under
  the progress bar until the next one has its data. Hovering a sidebar link warms it (router `defaultPreload: "intent"`).
- Helpers in `src/lib/queries/admin.js`: `adminSection(parts, fn)` (same key as `useAdminData`), `warmAdmin(qc, …)`
  (ensureQueryData, errors swallowed so the panel shows them), `adminLookups.{users,auctions,me}`.
  CRUD panels use `prefetchCrud(entity)`; Design uses `prefetchSiteTheme`.
- All panel skeletons removed (`if (loading) return null`); `src/components/skeletons/index.jsx` deleted.
  Kept: the brand splash (`PageSkeleton.jsx`, first load only) and in-panel loading after a click
  (Auction P&L detail cards, Payments page change, Analytics range change keeps old numbers).
- Not browser-tested.

### Flat look on the customer site (tasteskill rules)
- `<html data-look="flat">` is set statically in `RootShell` (`__root.tsx`), app-wide incl. admin (2026-11-23; LookScope.jsx deleted).
  CSS block at the end of `src/styles.css`: no coloured glows/blurred shadows (Tailwind shadow/drop-shadow utilities,
  native-panel/control, gold/cyan buttons, timer-glow, header glow, neon utilities, text glow, glow blobs); radius is
  half the admin Design value (`--radius-theme`, set by `applyTheme`). Menus/popovers/toasts keep one tight neutral shadow.
  Focus rings kept. Admin Design preview halves the radius too (`themeToStyle`).
- Small redesigns: MobileAuctionsHub empty state (no tilt, ring instead of shadow), Deposit arbitrary radii -> scale.
- Not browser-tested.

### /home redesign (attract + recent activity)
- `src/lib/homeHighlights.js`: spotlight, filling-fast, live pulse, next step, `feedAuctionIds` (live, non-sealed).
- Components in `src/components/home/dashboard/`: SpotlightHero, PulseStrip, NextStepCard, FillingFast, RecentActivity
  (tabs: Live bids = everyone's newest bids, names hidden, sealed never shown; Your wallet = own transactions).
- `useRecentBids` (`lib/queries/auctions.js`, key `["bids","recent",viewer,ids]`): one query + realtime filtered
  `auction_id=in.(ids)`, payload prepended. `/home` loader awaits it after the auction list.
- Desktop: spotlight + activity panel side by side, pulse, then next step / live shelf / filling fast / ending soon,
  aside = wallet + my auctions. Mobile (shared with public `/`): spotlight, pulse, activity (5 rows), filling fast.
- Not browser-tested.

### Admin fixed-height layout (2026-11-23)
- Decisions: admin only; lg+ (1024px) only, phones keep page scrolling; keep the current page-size options;
  every table gets its own fixed-height scroll box so it never stretches the page.
- `src/pages/Admin.jsx`: shell is `lg:h-dvh lg:overflow-hidden`; header + sidebar never scroll; `<main class="admin-main"
  key={active}>` is the only scroll area (key = new section starts at the top).
- `src/styles.css` (end): `.admin-main` is a size container; `.admin-table-scroll` (replaces `overflow-x-auto` on the
  22 admin table wrappers) caps at `max(16rem, 100cqh - --admin-table-room [8rem])`, 50dvh inside dialogs, sticky
  opaque `thead` with `--thead-tint` (AdminAuctions overrides it with accent). New admin tables: use `admin-table-scroll`.
- AdminDesign preview sticky `lg:top-20` -> `lg:top-0` (it sticks inside main now).
- Not browser-tested.
- Follow-ups: `<main>` has `lg:pt-0`, its inner div `lg:pt-6` (sticky top-0 meets the edge; scroll-container padding
  left a see-through gap). Sticky panel header pattern: `lg:sticky lg:top-0 lg:z-20 lg:-mt-6 lg:pt-6 lg:mb-0 lg:pb-6
  lg:bg-background` (AdminAnalytics title row). Fill-height panel pattern: root `flex flex-col gap-6
  lg:h-[calc(100cqh-1.5rem)]`, card `lg:flex-1 lg:min-h-64`, `admin-table-scroll admin-table-fill`, pagination outside
  the scroll box (AdminBidMonitor). Table cap room is 9.5rem.
- Unified admin tables (2026-11-23): `src/styles.css` gives every `.admin-table-scroll` table the Bid Monitor look at all
  sizes (th 2.5rem, td 2.75rem; buttons/inputs in cells capped at 2.25rem, w-11 icon buttons 2.25rem square, px 1rem, bottom border, muted heading on opaque card +
  secondary/60 tint; colspan cells keep their padding). Fill layout is now classes: `admin-fill` on the panel root +
  `admin-table-card` on the card (direct child) -> lg+: panel min-height = visible height, card flex `1 1 0px`, table
  scrolls inside, pagination in the card below. Used by: BidMonitor, AdminCrudTable (Activity logs, API keys, Brands,
  Pages, Reports, Shipping, Templates), Participants, Notifications, Fulfilment, Roles, Auctions. Capped (too much above
  the table): Payments (pagination moved out of the scroll box), Revenue, Auction P&L, Refunds, Verification, Test mode,
  finance panel, participant dialog. `admin-table-fill` class is gone.
- Sticky page titles (2026-11-23): `.admin-page-header` (src/styles.css, lg+) on the title row / title block of 26
  admin panels (first child of the panel root): sticky top-0, with the admin header's backdrop (bg 90%,
  blur 20px, no border), -1.5rem top/side margins into Admin.jsx content padding. Replaces AdminAnalytics' one-off classes.
  Not on Settings (profile card). AdminDesign preview sticky offset -> lg:top-28 (clears the sticky title).
  New admin panels: put `admin-page-header` on the title row.
- Charts: `.recharts-tooltip-cursor` hover fill = foreground/6%, focus outline removed (src/styles.css).
