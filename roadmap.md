# Roadmap

## Done
- [x] Premium native mobile auction detail layout with clear bidding hierarchy and unobstructed activity
- [x] Escrow holds replaced by per-bid model (free quota, then paid extra bids; winner pays via link)
- [x] Scheduled tick for auction end times (cron -> /api/public/finalize-auctions)
- [x] Ascending anti-sniping (extend end_time on last-second bids)
- [x] Client retry deduping (idempotency key on bid submits)
- [x] End-to-end run: full auction -> winner /pay link -> mark paid in Finance -> settled
- [x] Page metadata (title/description/OG) on every app route
- [x] Query indexes for notifications, wallet activity and live auction lists

## Open
- [x] Build screen 08: native admin profile and settings in navy, gold and cyan
- [x] Match every customer screen to the approved native auction-app reference
- [ ] Real payment provider capture for deposits and winner payments (needs provider keys)
- [ ] Email/WhatsApp delivery for notifications (currently logged in-app only)
- [ ] Push notifications for outbid / round closing / you won
- [ ] Admin dashboard KPIs over time (revenue trend, participation funnel)
- [x] Complete system-wide navy/gold/cyan native-app redesign and responsive verification
- [x] Rebuild signed-in Home to match reference screen 04 hierarchy and native styling
- [x] Redesign admin overview and auction management in the screen 04 navy/gold/cyan language
- [x] Add secure create, start, edit and immediate-close auction controls
- [x] Complete end-to-end native design and shared button consistency pass

## Admin scale (done)
- Business overview: revenue, cost, net profit, margin, ops alerts and 7/30/90/365-day range, aggregated in Postgres (`admin_dashboard`).
- Pagination on Participants, Users, Payments (server-side) and Bid monitor.

## Remaining launch work
- Real payment capture for deposits and winner links (needs provider).
- Email/WhatsApp/push delivery for notifications.
- Mobile card layouts for remaining dense admin tables.
