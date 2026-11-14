# Auction duration in hours (with day formatting)

## Goal
Admins set auction length in **hours** instead of minutes, and everywhere a length is shown the app prints it in human units: `45m`, `3h`, `1 day`, `2 days 5h`.

## What changes for the user
- Admin auction form: the "Duration (minutes)" field becomes "Duration (hours)", accepting decimals (e.g. `0.5` = 30 min, `24` = 1 day). Existing auctions show their current length converted to hours.
- Admin auctions table: duration column shows `1 day`, `2 days 5h`, `100h`-style text instead of `3000 min`.
- Auction detail (web + mobile) and auction cards: the duration stat and the pre-live label show the same friendly text.
- Live countdowns are untouched (still `hh:mm:ss`), and auctions running longer than a day show `dd:hh:mm:ss` so the number isn't misleading.
- Arabic copy gets matching words for hour/day.

## What does not change
- Storage stays in minutes (`duration_minutes`), so no database migration and no data rewrite. Hours are converted at the form boundary only.
- Timer / seat-quota closing logic, restarts, rounds, settlement: all unchanged.

## Technical notes
- `src/lib/auction.js`: add `formatDuration(minutes, t)` returning day/hour/minute text, and extend `formatCountdown` to prefix days when remaining time exceeds 24h.
- `src/components/admin/AuctionFormDialog.jsx`: hours field in local state; convert `hours * 60` into `duration_minutes` on save and `duration_minutes / 60` when loading an auction for edit.
- Replace raw `${duration_minutes} ${t.auction.minutes}` renders with `formatDuration(...)` in: `AdminAuctions.jsx`, `AuctionCard.jsx`, `HomeAuctionCard.jsx`, `MobileAuctionsHub.jsx`, `MobileAuctionDetail.jsx`, `pages/AuctionDetail.jsx`.
- `src/lib/i18n.jsx`: rename `durationMinutes` label to hours, add `hours` / `day` / `days` short strings (EN + AR), keeping English digits.
