# Mazady — Full migration from Base44 to Lovable

Port the entire Mazady auction platform (11 pages, 30+ admin panels, 24 data
models, 14 backend functions) onto this Lovable project, keeping the design,
layout, and full English/Arabic bilingual UI identical. Backend runs on Lovable
Cloud with a fresh database plus demo data.

## What changes and what stays

Stays identical: every screen's layout and styling, mobile-specific screens and
bottom nav, the complete EN/AR translation file with RTL, currency + theming
providers, all shadcn components.

Changes under the hood: routing moves from React Router to this project's
file-based router; the Base44 SDK is replaced by Lovable Cloud (database, auth,
storage); the 14 Base44 serverless functions become server functions here; JSX
files become TypeScript.

## Phases

### Phase 1 — Foundation
- Enable Lovable Cloud (database, auth, file storage).
- Port the design system: Tailwind theme tokens, fonts, global styles into the
  project's styles file, preserving the exact palette.
- Bring over shadcn/ui components, `lib/utils`, i18n provider (all 1,355 lines
  of EN/AR strings), currency provider, theme loader.
- Root layout with providers, RTL direction switching, and per-page metadata.

### Phase 2 — Database schema
Translate all 24 Base44 entities to database tables with row-level security
matching the original rules: Auction, Bid, User profile, WalletTransaction,
PaymentMethod, RefundRequest, Fulfilment, ShippingMethod, Coupon, Category,
Brand, Role, Notification, SupportTicket, Report, ActivityLog, ParticipantNote,
SiteSettings, Theme, Template, Page, Content, ApiKey, Verification.
Roles go in a dedicated roles table with a server-side permission check
function — never on the profile row. Seed demo categories, brands, users,
auctions, bids, and wallet history so every screen has content on first load.

### Phase 3 — Auth and shell
Email/password sign-in, registration, forgot/reset password, session handling,
suspended-account and unregistered states, protected routes, admin gating.
Layout, header, bottom nav, notification bell, language switcher.

### Phase 4 — Public and bidding flow
Home landing, Auctions hub (desktop + mobile), Auction detail with live
countdown and realtime bid updates, auction cards, winner badge, join-auction
entry-fee flow, place-bid validation, outbid notifications.

### Phase 5 — Wallet and account
Wallet balance, top-up requests, transaction history, refund requests, account
settings, change password, verification submission — desktop and mobile.

### Phase 6 — Admin console
All admin panels ported: users, roles, auctions + auction form, live monitor,
results, participants, payments, payment methods, refunds, fulfilment,
shipping, coupons, categories, brands, verification, support, reports,
notifications, broadcast, activity logs, analytics, settings, system, design,
hero, pages, content, templates, API keys.

### Phase 7 — Server logic and scheduling
Port the 14 backend functions as server functions with the same validation and
permission checks: placeBid, joinAuction, topup, approveTopup, requestRefund,
resolveRefund, resolveVerification, finalizeAuctions, claimFulfilment,
updateFulfilment, listUsers, updateUser, pauseUser, deleteUser. Add the
scheduled auction-finalization job that ends auctions, picks winners, and
notifies them.

### Phase 8 — Polish and verification
Walk every route in the browser, confirm bidding end-to-end, check Arabic RTL
rendering, verify admin permissions, run a security review of the policies.

## Technical notes

- Routing: one file per route under `src/routes/`, admin panels as nested
  routes under an admin layout; auth-gated subtree for logged-in areas.
- Data access: typed Cloud client with realtime subscriptions for live auction
  price and notification updates (replacing Base44 realtime).
- The Base44 `User` entity splits into Cloud auth users plus a `profiles` table;
  `role`/`permissions` move to the roles table with a security-definer check.
- Stripe payment code in the original is scaffolding only; ported as manual
  top-up approval unless you want live payments wired.
- Entry-fee joins and bids run server-side and atomically, as in the original.

## Open items to confirm later
- Live Stripe payments: wire up now or keep manual top-up approval.
- Google/Apple sign-in: the original has a Google button; enable managed social
  sign-in or email-only for now.
