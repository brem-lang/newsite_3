# Auctions, Winner, Wallet & Profile Fixes

## 1. Participation quota starts the auction
Today an auction goes live when either its scheduled time passes **or** all seats
(`max_subscribers`) are taken. There is no separate "minimum participants" value.

- Add a `min_participants` field to auctions (default = max seats, so nothing changes for
  existing rows), editable in the admin auction form.
- Auction goes live automatically as soon as joined participants reach `min_participants`
  (or the scheduled start time passes, unchanged).
- Auction detail page shows "Waiting for X more participants" until the quota is met, and
  flips to live without a manual reload (it already polls the lifecycle every 15s).

## 2. Winner name shown prominently
Only `winner_id` is stored today, and other users can't read someone else's profile, so no
name can be displayed.

- Store `winner_name` on the auction when it settles (server-side, from the profile).
- Show a winner banner at the top of the auction detail page (mobile + desktop) the moment
  the auction ends: trophy, winner name, final price. Winner still sees their own
  celebration/claim card.
- Ended auction cards in lists show "Won by <name>".

## 3. Real-time balance
The wallet balance is fetched once and only recomputed on manual refresh, so an entry fee
or winning charge doesn't appear until reload.

- Subscribe to the user's wallet transactions in real time; balance in the header, hub and
  wallet page updates instantly on any charge, top-up or refund.
- Also refresh right after join/bid actions as a fallback.

## 4. Profile information
- Add to each account: full name, WhatsApp number with country code, and full address
  (line 1, line 2, city, state/region, country, postal code).
- Account page (mobile + desktop) gets an editable "Personal details" form with validation
  (WhatsApp must include country code) and save feedback.
- Admin participant detail shows these fields so orders can be fulfilled.

## 5. Wallet transaction log
- Clean table/list: date+time, type badge (top-up, entry fee, winning bid, refund),
  description, signed amount, status badge.
- Newest first, with type/status filters and consistent currency + date formatting on both
  mobile and desktop.

## Technical notes
- Migration: `auctions.min_participants` (int), `auctions.winner_name` (text),
  `profiles.whatsapp_country_code`, `profiles.whatsapp_number`, `profiles.address_line1`,
  `address_line2`, `address_city`, `address_state`, `address_country`, `address_zip`.
  Profile columns stay self-editable under existing RLS; `winner_name` is written by the
  server settlement path only.
- `ensureAuctionState`/`settleAuction` in the server handlers gain the quota check and
  winner-name write.
- `useWallet` gains a realtime subscription on `wallet_transactions`.
