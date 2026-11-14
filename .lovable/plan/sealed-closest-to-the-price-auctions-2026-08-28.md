# Sealed "closest to the price" auctions

A second auction format alongside the current highest-bid one. The admin sets the real
selling price of the product (e.g. 200), and the winner is the participant whose unique
number sits closest below that price.

## How a round plays out

1. Admin creates an auction, picks type **Closest to price**, and fills in: target price
   (200), seats, duration, bid increment, entry fee.
2. Users join by paying the entry fee (unchanged) and then submit numbers.
3. A number must be greater than 0, at most the target price, and a whole multiple of the
   bid increment (increment 0.01 → 199.01 is valid; increment 1 → only 199, 198, ...).
4. Numbers are **sealed**: a user sees only their own numbers plus the public list of burned
   numbers. No leaderboard, no current price, no "outbid" notifications during the round.
5. If a second user submits a number that is already taken, that number is **burned**: both
   the earlier and the new bid are voided, the number can never be used again in this round,
   and both users stay in the game and may submit other numbers.
6. A user may submit several numbers over the round; each one is charged nothing up front but
   requires their wallet balance to cover it (same funds check as today).
7. The round closes on the existing rule (timer at zero **and** seats full). The winner is the
   highest still-active number, i.e. the one closest below the target price. If every number
   burned, there is no winner. The winner's wallet is charged their winning number.

## What users see

- Bid panel: "Your number" with target price shown, plus a hint on the allowed step.
- A "Burned numbers" list (read-only chips) so users avoid dead numbers.
- "Your numbers" list with each of the user's own bids marked active or burned.
- Leaderboard / activity feed / current-price blocks are hidden for this auction type; after
  the round ends the winning number and winner name are shown as they are today.
- Instant feedback when a submission burns a number: "That number was taken — it is now
  burned for everyone."
- English and Arabic strings for all new copy.

## Admin

- Auction form gains a **Type** selector (Highest bid / Closest to price) and a **Target price**
  field shown only for the closest-to-price type.
- Admin live view and results view show, for these auctions, the burned numbers and the
  active numbers per user (admin can see everything, including during the round).

## Technical notes

Database migration:
- `auctions.mode text not null default 'highest'` with a check for `('highest','closest')`.
- `auctions.target_price numeric` (used only for `closest`).
- `bids.burned boolean not null default false` and `bids.burned_at timestamptz`.
- Partial unique index on `(auction_id, round, amount)` for non-burned bids is not usable
  (burning voids two rows), so uniqueness is enforced inside a new Postgres function.
- New `public.place_closest_bid(_auction_id uuid, _user_id uuid, _amount numeric) returns jsonb`,
  security definer, locking the auction row `FOR UPDATE`:
  validates status/seat membership/window, validates the amount against target and increment,
  then: if the number already exists as burned → reject `number_burned`; if it exists as an
  active bid by another user → mark both that bid and the new one burned and return
  `{ok:true, burned:true}`; if it is the caller's own active number → reject `duplicate_own`;
  otherwise insert the bid. `current_price` / `highest_bidder_id` are left untouched for this mode.

Server (`src/lib/backend/handlers.server.ts`):
- `placeBid` branches on `a.mode`: `closest` calls the RPC above (keeps the existing wallet
  balance check and skips the ascending-increment check and outbid notification).
- `settleAuction` branches on mode: for `closest`, the winner is the highest non-burned bid of
  the current round with `amount <= target_price`; that amount is charged and stored in
  `current_price` so all existing winner UI keeps working. No non-burned bid → no winner.
- Round reopen/archive logic is unchanged; burned bids archive with their round.
- New read handler `auctionBidState` returning `{ burned: number[], mine: [{amount, burned}] }`
  for the signed-in user, so sealed mode never leaks other users' active numbers to the client.

Frontend:
- `src/lib/auction.js`: helpers `isClosestMode`, `validClosestAmount`.
- `BidPanel.jsx` gets a sealed variant; `AuctionDetail.jsx` and `MobileAuctionDetail.jsx` hide
  price/leaderboard blocks and render the burned/mine lists for this mode.
- `AuctionFormDialog.jsx`, `AdminLive.jsx`, `AdminResults.jsx`, `AuctionBidsLog.jsx` updated for
  the new fields and burned markers.
