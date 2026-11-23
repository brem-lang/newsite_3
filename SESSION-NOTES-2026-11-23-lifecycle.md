# Auction lifecycle (Auction_Lifecycle_Specification.docx.pdf) — 2026-11-23

Decisions (user): relaunch = same row as the next round (a); relaunch lands in `open`; status dropdown kept but
limited to allowed moves through server actions; no scheduled queue for now; auto-start on first join/schedule kept
and logged as `auction.started` source `system`. Not deployed, not browser-tested, uncommitted.

## Lifecycle
open -> live -> ended -> Relaunch (open, round+1) | Archive ; voided -> Relaunch | Archive ; archived = read-only.
Customer pages treat `archived` as `ended` (`src/lib/auction.js` effectiveStatus). Admin uses `adminStatus`.

## Server (`supabase/functions/api/handlers.ts`)
- Removed `reopenLastEndedIfAllEnded` (was called by the tick AND by any viewer's `syncAuction`).
- Tick (`finalizeAuctions`) only processes open/live; logs `queue.empty` (system) on the tick that closed the last one.
- New actions (cap `auctions.manage`): `startAuction`, `relaunchAuction`, `archiveAuction`; `closeAuction` now logs
  via settle. All conditional updates -> second concurrent click gets 409.
- `relaunchAuction` blocked (422) while the round's winner payment is pending, or a paid win has no finished
  fulfilment (delivered/collected/confirmed/cancelled). Resets winner/price/seats/restart_count, round+1,
  relaunch_count+1, archives the round's bids.
- `logLifecycle` -> activity_logs (action = event name, `source` admin|system, JSON details).
  Events: auction.started / ended / voided / relaunched / archived, queue.empty.
- `recordRound` -> `auction_rounds` (outcome won/no_winner/voided, winner, price, payment_id, `recovered`).
- `settleAuction(a, source, actor)`: `recovered: true` when the tick ends it > 2 min after end_time.
- join/bid refuse archived/voided; claimFulfilment works for archived and is per round (`fulfilments.round`).

## Migration `supabase/migrations/20261123000000_auction_lifecycle.sql`
auctions.relaunch_count; activity_logs.source (+ indexes, realtime publication); fulfilments.round (backfilled);
auction_rounds (+ backfill of ended/voided rounds, admin-only RLS); trigger `guard_auction_writes` for browser
sessions only: insert must be `open`; no status change; round/timer/price/winner/participants server-only; locked
while live: start_price, bid_increment, duration, seats, fees, mode, target, numbers; delete only never-run auctions.

## Admin UI
- `src/lib/auctionLifecycle.js` (allowed moves, action per move, runLifecycle -> LifecycleConflict on 409).
- AdminAuctions: dropdown = allowed moves; Start / End now / Relaunch + Archive buttons; delete only never-run;
  Archived tab (read-only card view); "All" excludes archived. AdminResults includes archived.
- AuctionFormDialog: status select = allowed moves, runs the action after save; locked fields disabled while live;
  never re-sends current_price; History section (`AuctionHistory.jsx`).
- Header bell `AdminSystemEvents.jsx`: system events, live via realtime + toast, unread badge (localStorage).

## Deploy order
1. Apply the migration (psql as postgres). 2. Copy `supabase/functions/api` to the instance (README). 3. Frontend.
Frontend before migration = status writes still allowed; function before migration = inserts into missing
columns/tables fail silently (best-effort logging) but relaunch_count update would fail -> do migration first.

## Test checklist (spec section 8) — no test framework in the repo; manual, with evidence
1. 5 auctions, let all end, wait 3+ ticks: none reopen; bell shows "Nothing left open or live".   (items 1, 2, 11, 12)
2. Ended row: Relaunch + Archive instead of End now; Delete hidden; API delete via REST refused.   (3, 9)
3. Relaunch: row -> Open, round+1, relaunch_count+1, History shows staff name + time.              (4, 6)
4. Two tabs click Relaunch: second toast = conflict, row refreshes.                                (7)
5. Stop pg_cron / function past an end time, restart: bell + History show "ended late".           (8)
6. Won round with pending payment: Relaunch refused with the reason.
7. Edit a live auction: price/fees/seats/duration disabled; title saves; REST PATCH of price refused.
(Scheduled queue items 5/10-queue: not built, by decision.)
