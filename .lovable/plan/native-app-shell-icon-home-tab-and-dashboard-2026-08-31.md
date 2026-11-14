# Native App Shell: Icon, Home Tab, and Dashboard

Turn the mobile experience from "website with tabs" into a real installable app shell: an app icon you can add to the home screen, a dedicated Home tab, and a native-style dashboard as the first screen after sign-in.

## 1. Real app icon + installability

- Generate a square brand mark (gavel/auction motif on the existing brand blue) and ship it as the app icon.
- Add `public/manifest.webmanifest` with app name "Mazady", short name, `display: standalone`, theme/background colors, and 192/512 icon entries.
- Wire `manifest`, `theme-color`, `apple-touch-icon`, and the new favicon into the root route head; drop the default Lovable `favicon.ico`.
- Home-screen install only — no offline mode or service worker (nothing asked for offline, and it adds cache/update risk).

## 2. Dedicated Home tab

- New signed-in route `/home` that renders the dashboard; signed-in users landing on `/` go to `/home` instead of `/auctions`.
- Bottom tab bar becomes 5 real destinations instead of query-string filters on one page:
  Home (`/home`), Auctions (`/auctions`), My Bids (`/auctions?tab=mine` → dedicated tab view), Wallet (`/wallet`), Profile (`/account`).
- Active state driven by route, not `?tab=`, so tab highlighting stops being ambiguous.

## 3. Native-like dashboard (replaces website tabs on mobile)

Vertical, card-based dashboard instead of the marketing page layout:

```text
┌───────────────────────────────┐
│ avatar  Hi, Ahmad     bell    │  compact app bar (safe-area)
│ Balance  $240.00   [Deposit]  │  wallet card
├───────────────────────────────┤
│ Live now  ▸                   │  horizontal snap carousel
│ [card][card][card]            │
├───────────────────────────────┤
│ My active bids                │  seat + bid-quota status per auction
│ Ending soon                   │  countdown rings
│ Recent activity               │  bids / deposits / wins
└───────────────────────────────┘
│ Home  Auctions  Bids  Wallet  │  fixed tab bar
```

- Reuses existing data hooks (auctions list, wallet, bids) — no new backend work.
- Native touches already established in the app: safe-area padding, 44px tap targets, press-scale feedback, hidden scrollbars with snap scrolling, skeleton loaders, pull-to-refresh.
- The marketing home (hero, how-it-works, about) stays as the public landing page for signed-out visitors and on desktop.

## Technical notes

- New files: `src/routes/_app.home.tsx`, `src/pages/Dashboard.jsx`, `src/components/home/dashboard/*` (WalletCard, LiveCarousel, MyBidsList, ActivityList), `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/favicon.png`.
- Edits: `src/routes/__root.tsx` (head links/meta), `src/routes/index.tsx` (authed redirect → `/home`), `src/components/BottomNav.jsx` (route-based tabs), `src/components/Layout.jsx` (add Home to desktop nav, hide web header chrome on mobile dashboard).
- Desktop layout and all admin screens are untouched.
- Each new route gets its own `head()` metadata.
