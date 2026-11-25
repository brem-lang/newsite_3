# Server-side Pagination Tracker

Started 25 Nov 2026. Goal: no admin table loads more rows than it shows. Paging, search, filters
and the total count all run in Postgres through `entity.page()` (`src/api/base44Client.ts`), an
edge-function equivalent, or an aggregate RPC. Every table uses the shared `AdminPagination` footer.

Legend: ✅ done (code) · ⏸️ deferred · ➖ not needed
Priority: 🔴 High · 🟠 Medium · 🟢 Low

## Status: code complete, not deployed, not browser-tested (25 Nov 2026)

Everything is uncommitted. See the **Deploy checklist** below.

## Why
Audit (25 Nov 2026): only **Payments** paged on the server. Every other table fetched a capped batch
(100–5000 rows) and sliced it in the browser, so rows past the cap went missing with no error, and
search only looked inside what had been loaded.

## Tasks

| # | Pri | Table(s) | Before | Now | Status |
|---|---|---|---|---|---|
| 1 | 🔴 | `AdminCrudTable`: Activity Logs, API Keys, Brands, Pages, Reports, Shipping, Templates | `entity.list()`, no limit, sliced in the browser | `entity.page()`: search, sort and page size run in Postgres; CSV export fetches every match | ✅ |
| 2 | 🔴 | Participants, Users (`listUsers` edge function) | 1000-row caps, filtered in the browser | `listUsers` pages, searches and filters by status/role; super admins hidden **on the server**; "select all matching" via `idsOnly` | ✅ |
| 3 | 🟠 | Notifications | `list(500)` | `.page()` with the channel filter; names looked up only for the rows on screen | ✅ |
| 4 | 🟠 | Verification | `User.list(500)` | two `listUsers` pages (queue / reviewed) + server status counts | ✅ |
| 5 | 🟠 | Refunds | `list(500)` + 1000 transactions | `.page()` per status; amounts looked up by id for the rows on screen | ✅ |
| 6 | 🟠 | Fulfilment | `list(500)` + 500 auctions | `.page()`; stage cards from `count()`; auction / winner labels by id | ✅ |
| 7 | 🟠 | Bid Monitor | `list(300)`, stats over those 300 | `.page()` with the severity filter; stats from `admin_bid_monitor_stats`; realtime still prepends to page 1 | ✅ |
| 8 | 🟠 | Auctions: Ended / Archived tabs + stat cards | `Auction.list(100)` for everything | `admin_ended_auctions` (search, dates, paid, paging, bid counts, revenue totals over every match); stat cards from `admin_auction_counts` | ✅ |
| 9 | 🟢 | Revenue, Payments summary | 5000 transactions + 2000 users summed in the browser | `admin_revenue_by_auction` / `_daily`, `admin_payments_summary` (totals, 30-day chart, approvals queue) | ✅ |
| 10 | 🟢 | Auction P&L, Finance panel Rounds tab | 3000–5000 bids/transactions per auction | `admin_auction_pl` (fees, deposits, bid counts, per-participant roll-up); P&L list paged + searched; `admin_auction_rounds` | ✅ |
| 11 | 🟠 | Results | `Auction.filter(ended/archived, 100)` | `.page()`; full winner profiles by id for the rows on screen | ✅ |
| 12 | 🟠 | Support | `list(200)`, chip counts over those 200 | `.page()` with the status filter; chip counts from `count()` | ✅ |
| 13 | 🟠 | Winner payments (`listWinnerPayments`) | `limit(500)`, searched in the browser | edge function pages and searches (auction title, winner, token, reference); totals from `admin_winner_payment_totals` | ✅ |
| ✅ | | Payments ledger table | already used `.page()` | | ✅ |
| ➖ | | Roles, Categories, Content, Coupons, Payment methods, Image picker | small config lists that stay small | | ➖ |
| ➖ | | Revenue stream | a "latest 400" live feed by design | | ➖ |

### Deferred (still capped, lower impact)
| Where | Cap | Why it's left | Fix when needed |
|---|---|---|---|
| Shared lookups `useAdminUserMap` / `useAdminAuctionMap` | 2000 users / 500 auctions | Still label rows in the Auctions working-set table and the bid logs (`AuctionBidsLog`) | Switch those to `useAdminUsersByIds` / `useAdminAuctionsByIds` |
| Payments, manual-adjustment recipient picker | 2000 users in a `<select>` | Now only loads when the dialog opens | Searchable combobox backed by `listUsers` search |
| Participants, grant-free-bids auction picker | 200 auctions | Newest auctions are the ones you grant on | Searchable picker |
| `auctionBidsQuery` (bid log, Ended CSV bid history) | 500 bids / auction | Display list; totals no longer depend on it | Page the bid log |
| Live monitor (`AdminLive`) | 1000 bids, 500 credits, 1000 txns per live auction | Live view, needs its own realtime-aware design | Aggregate RPC per live auction |
| Auctions working set | 1000 non-ended auctions | Open/live/voided auctions stay few | Page it if it ever grows |

## Behaviour changes to know about
- **Auctions "All" (Total) tab** pages every non-archived auction, ended ones included, in Postgres
  (`adminKeys.auctionsAllPage`), so it matches the "Total" count. The Open / Live tabs still filter the
  working set. (Fixed 25 Nov 2026: it used to list only the working set, so ended auctions were missing.)
- **Ended tab** shows auctions whose status is `ended`. A live auction whose timer ran out appears
  there once the server marks it ended (`syncAuctions`). Before that it shows in "All" with the ended badge.
- **Verification queue** is members with status `pending` (the column is never null).
- **CRUD search** matches stored values. For select fields that means the value (`open`), not the label.
- **Super admins** are no longer sent to regular admins at all. Before, they were sent and hidden in the browser.

## Query keys (centralised)
Every key is built in `src/lib/queries/keys.js`. There are no inline `queryKey: [...]` arrays left in `src/`.
- `useAdminData(key, fn)` / `adminSection(key, fn)` now take a full key from `adminKeys`.
- Paged tables: `useAdminPage(entity, adminKeys.xPage, filters)` returns rows, total and `pagination` for `<AdminPagination {...} />`.
- Prefix builders (`adminKeys.auctionsAll()`, `usersByIds()` with no args, …) are for invalidation.
- Customer keys: `bidKeys.mine / byAuctionAll / summaryAll`, `walletKeys.*`, `auctionKeys.mine`, `configKeys.settings` replace their literals.

## Deploy checklist
- [ ] Apply `supabase/migrations/20261125000000_backfill_missing_profiles.sql` (profile backfill RPC + 3 indexes)
- [ ] Apply `supabase/migrations/20261125010000_admin_aggregates.sql` (aggregate RPCs + indexes)
- [ ] Deploy the `api` edge function (`listUsers` and `listWinnerPayments` are paged)
- [ ] Browser test each screen in the table above: paging, page size, filters, search, empty state, CSV export, and an action that changes a row (approve, advance, delete)

**Order matters:** deploy the SQL and the edge function **before** the front end. The new screens
call the RPCs and expect the paged edge-function responses.

## Verification done (25 Nov 2026)
- `vite build` passes. A script confirmed every named import from the query modules exists, every
  `adminKeys.*` builder used is defined, and no inline query keys remain.
- One-off `no-undef` ESLint pass over `src/components` and `src/lib`: clean. The only warnings are
  pre-existing ones in files this work didn't touch.
- `tsc` over `supabase/functions/api/handlers.ts`: no errors.
- Both migrations run in **PGlite** (Postgres 17 in WASM) against a stub of the real schema. 40
  checks cover the backfill, every RPC's numbers, search, filters, paging and the non-admin
  refusal, and all pass. Script: the session scratchpad `pgtest/test.mjs`, not in the repo.
  This caught a `bigint`/`numeric` mismatch in `admin_auction_rounds` before deploy.
- **Not done:** any run against the real database or a browser.

## Log
- 25 Nov 2026: tracker created from the audit.
- 25 Nov 2026: #1–#2 done (AdminCrudTable, listUsers).
- 25 Nov 2026: #3–#13 done; query keys centralised; aggregate RPC migration added and tested in PGlite.
