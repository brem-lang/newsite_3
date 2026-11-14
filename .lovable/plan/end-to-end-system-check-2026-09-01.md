# End-to-end system check

Full verification pass over the live system after the bidding change (bids no longer require the full amount in the wallet; only entry fees, per-bid fees and extra bids touch the balance; the winner pays afterwards through a payment link).

## What gets checked

1. **Automated suites** — run the existing stress/flow tests (`scripts/tests`: full flow, bid concurrency, ascending load, escrow, number pool, leaderboard masking, live monitor). Any failure gets diagnosed and fixed, not just reported.
2. **Live walkthrough with real users** — run `scripts/live-e2e.ts` against the running app with the QA accounts, covering:
   - Register / login (English + Arabic, RTL)
   - Deposit funds and see the pending entry in Recent activity
   - Join an auction (entry fee deducted once, seat counted once)
   - Rising-price auction: place bids with a low balance (must now be allowed), free quota, quota exhausted, buying extra bids, per-bid fee, anti-snipe extension
   - Closest-price auction: duplicate numbers burn, free-pool compression, fairness gate, masked leaderboard
   - Round close: timer + minimum participants, restart when seats short, void + refund at the restart cap
   - Winner: payment link, mark paid, settlement recorded once
3. **Browser pass on mobile viewport** — walk the same auction screens the user is on now, checking the bid panel, wallet card, countdown ring, and error toasts render correctly and show English digits.
4. **Money reconciliation** — for each auction touched, compare wallet transactions against entry fees, bid fees, extra bids, refunds and the winner charge, so there is no double-charge and no missing refund.
5. **Data + security sweep** — backend linter and RLS/grant check on the tables involved, plus a look at recent bid/auction logs for anomalies.

## Deliverable

A single report listing, per area: pass/fail, what was observed, and every fix applied during the pass. Anything I cannot verify without your input (e.g. real payment provider capture) is called out explicitly instead of assumed.

## Technical notes

- Suites run via `bun test scripts/tests` (also `test:stress`); the escrow suite is run on its own because parallel runs previously interfered with its clock assertions.
- Live walkthrough uses `bun scripts/live-e2e.ts` with the existing QA users; no new schema changes are planned unless a bug requires one.
- Browser checks use Playwright against `http://localhost:8080` at 393x852.
