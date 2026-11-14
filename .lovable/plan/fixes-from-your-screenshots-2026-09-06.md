# Fixes from your screenshots

## 1. Bidder names in the leaderboard
Today other bidders show as initials only (`A.A.`) and the numbers stay hidden as `••••`.

- Show the bidder's real display name (first name + last initial when a full name exists, email prefix otherwise) instead of initials.
- Keep sealed numbers hidden while the round runs, then reveal every number automatically once the round ends.
- Add a "Show all bids" link under the leaderboard that opens the full bid list for that round (names + numbers, with live numbers still masked until the end).

## 2. Reveal the numbers at the end
- When a closest-price round ends, the leaderboard, "Your numbers" and "Burned numbers" cards all switch to the revealed state: every participant's number, who burned what, and the winning gap.

## 3. Wallet: show bidding spend
The wallet card only shows money. Add two figures next to the balance:

- Money spent on bids in the current period (entry fees + bid fees + extra bids).
- Number of paid/extra bids bought, and free bids still available across joined auctions.

## 4. Clearer messages instead of red errors
The three toasts in the screenshots are correct rules but read like failures. Replace with actionable messages:

- "You used all your numbers (5) in this round" -> show remaining quota inline on the bid panel and offer the "Buy extra bids" action in the same toast.
- "This number was taken - it is burned" -> keep the warning, but suggest the closest still-free number so the user can retry with one tap.
- "Your identity must be verified before joining" -> show it as a persistent notice on the auction page with a link to the verification step, not a red error each time.

## 5. Entry-fee consistency
Re-check the auction detail header so the fee badge, the join button and the seat hint always read the same auction value (no mixed 10 / 25 / 20).

## Technical notes
- `src/lib/leaderboard.js`: add name resolution + a `revealAll` path; keep the pure model so the existing masking tests still cover it.
- `src/components/auction/Leaderboard.jsx`, `SealedBidPanel.jsx`, `MobileAuctionDetail.jsx`: render names, reveal-on-end, "show all bids" sheet.
- `src/lib/backend/handlers.server.ts` (`auctionBidState`): return full display names; keep amounts masked server-side while live so nothing leaks.
- Wallet figures come from `wallet_transactions` types `subscription`, `bid_fee`, `bid_credits` plus `bid_credits` rows; rendered in `src/pages/Wallet.jsx` and `MobileWallet.jsx`.
- Bid-panel messages live in `src/lib/i18n.jsx` (English + Arabic) and the quota/burn branches of the bid handlers.
