# Participant 360 — full activity & money log

Today the participant popup only shows four counters (auctions joined, total bids, wins, balance) plus notes and a wallet adjust box. The goal is a complete file on each participant: every auction, every bid, every payment, and every action, with history.

## What you'll get

Clicking a participant opens a full-screen detail view with tabs:

**1. Overview**
- Profile block (name, email, phone + WhatsApp, country, address, IP, registration date, verification status, paused flag, roles).
- Money summary: current balance, total deposited, total spent (entry fees, bid fees, extra bid credits, winner payments), refunds, net.
- Activity summary: auctions joined, auctions won, total bids, burned numbers, extra bids bought, last seen activity date.

**2. Auctions**
One row per auction the participant ever joined, showing: auction title + link, mode (highest / closest), status, seats, join date, entry fee paid, bids used vs quota (incl. purchased credits), bid fees paid, burned numbers, best/closest number and gap to selling price, win/lose result, and amount charged if winner. Expanding a row lists that participant's full bid history for the auction, live round and archived rounds separately, with timestamps, amount, burned flag and round number.

**3. Bids**
A flat, searchable, paginated log of every bid ever placed by this participant across all auctions: date/time, auction, round, number/amount, burned or active, archived, and the fee charged for it. Filters by auction, round, status; sortable by date.

**4. Payments**
Every wallet transaction: date, type (deposit, entry fee, bid fee, extra bid credits, winner charge, refund, manual adjustment), amount signed, running balance, status, linked auction, payment method / reference, and who created it if it was a manual admin adjustment. Filters by type, status and date range, plus totals per type.

**5. Log / history**
Chronological unified timeline merging: registration, verification changes, joins, each bid (accepted, burned, rejected reason from the bid-event audit trail such as quota reached, rate limited, waiting for others, insufficient funds), extra-credit purchases, wallet movements, notifications sent to him, support tickets, fulfilment/claim submissions, refund requests, and staff notes/admin actions taken on his account.

Every tab has CSV export, and the whole participant file has one "Export full report" button.

## Technical notes

- New server handler `getParticipantFile(userId)` in `src/lib/backend/handlers.server.ts` (admin-only, service role), returning: profile + roles, wallet transactions, bids (live + archived), bid_credits, bid_events for that user, auctions joined (matched via `subscriber_ids` and via bids), wins, notifications, support_tickets, fulfilments, refund_requests, participant_notes, and activity_logs rows targeting the user. One round-trip instead of the current 4 client queries, so the popup stays fast.
- Aggregation (per-auction rollups, running balance, timeline merge) computed in a pure module `src/lib/participantFile.js` so it can be unit-tested and reused.
- `ParticipantDetailDialog.jsx` becomes a tabbed dialog (wide, mobile-safe, RTL-aware) consuming that one payload; existing notes and wallet-adjust actions stay where they are, on the Overview tab.
- No schema changes needed — all data already exists in the tables. Read-only additions except the existing note/adjustment actions.
- English/Arabic translations added for all new labels; all numbers rendered with the existing Latin-digit formatter.

## Out of scope
No changes to bidding logic, fees or settlement — this is reporting only.
