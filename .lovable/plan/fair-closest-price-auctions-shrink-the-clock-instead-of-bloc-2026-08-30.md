# Fair closest-price auctions: shrink the clock instead of blocking bids

Nothing gets blocked. Every participant can bid on any free number at any time. Instead of stopping the last collision, the auction watches how many numbers are still free and shortens its own remaining time as the pool runs out, so it always ends while at least one unique number is still standing.

## What changes for participants

- The "this number can't be taken" rejection I added earlier is removed. Collisions burn as before, with no exceptions.
- The auction shows how many numbers are still free out of the total, and a note that the auction closes sooner as the pool empties.
- The countdown simply gets shorter when numbers are consumed fast. It never gets longer.

## The rule

Every whole currency unit contains 100 numbers (0.01, 0.02 ... 0.99, 1.00), so the pool is counted in cents, using the auction's own step (0.01 by default):

```text
total numbers  = target price / step in cents   (target 1.00 -> 100 numbers,
                                                 target 500 -> 50,000 numbers)
used numbers   = distinct numbers already bid this round (active + burned)
free numbers   = total - used
free ratio     = free / total
```

All counting is done in integer cents, so no rounding drift: `total = round(target_price * 100) / round(step * 100)`. With a 500 target and the default 0.01 step there are 50,000 numbers, so a normal auction never comes close to running out — the clock only shortens on small targets or very heavy bidding.


After every accepted bid, the remaining time is compressed in proportion to how much of the pool is gone:

```text
remaining_now  = end_time - now
new_remaining  = remaining_now * free_ratio     (never larger than remaining_now)
end_time       = now + max(new_remaining, 60s)
```

And a hard stop: when the free pool drops to the safety floor (5% of total, minimum 3 numbers) the round ends immediately and settles on the highest active non-burned number at or below the target price.

Effects:
- Plenty of numbers left -> the clock is barely touched, the auction runs its full duration.
- Pool half gone -> remaining time is roughly halved.
- Pool nearly gone -> the auction closes within seconds, while unique numbers still exist.

The 60-second floor is there so the auction never dies mid-bid, and the ratio only ever pulls the deadline in, so the timer can't bounce around.

## Technical notes

Database migration:

1. Rewrite `public.place_closest_bid`: drop the `last_unique_number` guard entirely. After a bid is recorded (both the normal and the burn path), still under the existing `FOR UPDATE` row lock, compute total/used/free and update `auctions.end_time` per the formula. When free numbers hit the floor, set `end_time = now()` so the normal settlement path closes the round on the next clock sync. Return `free`, `total`, and the new `end_time` in the result JSON.
2. Keep `bid_window_start`, the quota, the fairness gate and the pace limit exactly as they are.

App code:

- `src/lib/backend/handlers.server.ts`: remove `last_unique_number` from `classify`; keep the burned-number settlement fallback in `closestWinner` as a safety net. `auctionBidState` also returns `total_numbers` and `free_numbers` so the UI can display the pool. `ensureAuctionState` needs no change — a pulled-in `end_time` closes the round through the existing timer path.
- `src/pages/AuctionDetail.jsx`: remove the `last_unique_number` error mapping; after a successful bid, refresh the auction row so the shortened countdown appears immediately (realtime already patches other viewers).
- `src/components/auction/SealedBidPanel.jsx`: add a "free numbers: X of Y" line plus the short explanation that the auction ends sooner as the pool empties.
- `src/lib/i18n.jsx`: drop `errLastUniqueNumber`, add the free-pool labels (English and Arabic).
- `src/components/admin/AuctionFormDialog.jsx`: the number-space check stays, but only as advice — the "too small" case becomes a warning instead of an error, so saving is never blocked by it. The pace-window error remains the only blocker.

## Verification

- Typecheck, then load `/admin/auctions` and an auction detail page.
- Extend `scripts/tests/bid-concurrency.test.ts`: many concurrent bids into a deliberately tiny number space must always leave at least one active non-burned number, must produce exactly one settlement, and `end_time` must only ever move earlier.
