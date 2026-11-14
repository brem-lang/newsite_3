# Auction reliability upgrade

Three highest-impact fixes to the auction logic and flow.

## 1. Funds exposure (soft hold)
Today a participant's balance is only checked at the moment of each action, so the same
balance can be committed to several live auctions at once.

- Track committed exposure per user: sum of their current leading ascending bids plus
  pending winner charges.
- Available balance = wallet balance - exposure. All checks (join, bid, extra credits)
  use available balance.
- Exposure is released when a user is outbid, when a round is archived, or at settlement.
- Enforced inside the existing locked database functions, so it stays race-proof.

## 2. Winner payment is manual (payment link)
The winner is never auto-charged from the wallet. When a closest-price or highest-bid
auction settles, the win is recorded as unpaid and payment is collected manually.

- At settlement the auction is marked `awaiting_payment` with the final price recorded;
  no wallet deduction happens for the winner.
- A payment request is created per win with a unique link the winner can open later to
  pay (or to send their details for manual follow-up).
- Admin sees every unpaid win in Revenue/Ended with actions: copy/send the payment link,
  mark as paid manually (with note and reference), or void the win.
- Voiding promotes the runner-up (next closest number, or next highest bid) once and
  issues them their own payment link; if that also fails the auction closes unsold.
- Revenue counts winner payments only once they are marked paid, so profit figures stay
  accurate while a link is outstanding.


## 3. Restart cap with refunds
Rounds can restart forever when the minimum seat target is never met.

- Add a configurable max restart count per auction (default 3).
- On reaching the cap, the auction is voided: entry fees, bid fees, and unused extra
  bid credits are refunded as wallet transactions, exactly once (idempotent by round).
- Participants get a notification explaining the void and refund.

## Technical notes
- Schema: exposure tracking, a winner payment-request table (token, amount, status, paid
  reference), `auctions.restart_count` + `max_restarts`, auction status values
  `awaiting_payment` / `voided`, with GRANTs and admin-only RLS (winner can read own
  payment request by token).
- Logic lives in the existing `place_ascending_bid`, `place_closest_bid`,
  `join_auction_atomic`, `buy_bid_credits` functions and the settlement path in
  `src/lib/backend/handlers.server.ts`.
- Tests: extend the stress and full-flow suites with exposure over-commit, unpaid-win
  settlement with runner-up promotion, and restart-cap refund idempotency cases.
