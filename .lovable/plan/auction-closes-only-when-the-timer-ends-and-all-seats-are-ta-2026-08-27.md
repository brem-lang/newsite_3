# Auction closes only when the timer ends AND all seats are taken

## The new rule

An auction round can only finish when **both** are true:

1. The countdown has reached zero, and
2. The seat target (participants needed) is full.

Neither one alone closes it.

## Behaviour

- **Goes live** — unchanged: the round starts on the first join (or its scheduled start), and the countdown begins.
- **Timer hits zero, seats not full** — the timer restarts for another full duration. This repeats as many times as needed until the seats fill.
- **Seats fill before time is up** — bidding keeps going; the round stays live until the countdown reaches zero.
- **Timer hits zero with seats full** — round closes, the highest bidder wins, wallet is charged and the winner is announced (existing settle logic, unchanged).

## UI changes

- Auction detail (mobile + desktop): the status pill shows "Waiting for seats" when the clock has cycled and seats are still open, and "Closing at 00:00" once the seats are full.
- Seats card copy: "Closes when the timer ends and all N seats are taken" plus a small note that the timer restarts if seats aren't full.
- The Join → Bid → Winner strip keeps its simple wording; only the one-line explanation is updated to match the AND rule.
- English and Arabic strings both updated.

## Technical notes

- `ensureAuctionState` in `src/lib/backend/handlers.server.ts`:
  - The live-to-ended check becomes `timeUp && seatsFull` instead of `timeUp || quotaHit`.
  - When `timeUp` is true and seats are not full, `start_time` is advanced to now and `end_time` is recomputed as now + `duration_minutes` (a restarted round). This replaces the current "realign end_time to start_time + duration" block so the two rules don't fight each other.
  - `closeQuota` stays as the seat target (`min_participants`, capped by `max_subscribers`, falling back to `max_subscribers`).
- Bid placement still rejects bids after `end_time`; with the restart, `end_time` always sits in the future while a round waits for seats, so bidding stays open.
- No database schema change is needed; the cron/sync path already calls `ensureAuctionState` for every row.
