# Fix ended auctions showing "10 min / 15 min / 3000 min"

## Problem
On the auctions tiles (and the home/desktop cards), every auction shows a clock icon followed by the raw `duration_minutes` value — e.g. `10min`, `15min`, `3000min` — **even when the auction is already ended**. That makes ended auctions look like they still have a running timer, which is what you're seeing as "ended auction showing 10 min instead of ended".

Root cause (confirmed in the live preview):
- `MobileAuctionsHub.jsx:265`, `AuctionCard.jsx:39`, and `HomeAuctionCard.jsx:43` all render `{auction.duration_minutes}{t.auction.minutes}` unconditionally, regardless of status.
- The backend restart rule you confirmed is already correct and stays as-is: when a live auction's timer hits 0 but seats aren't full, the timer restarts for the same duration; it only ends (settles) when the timer hits 0 **and** seats are full. No change needed there.
- Secondary inconsistency: `effectiveStatus` in `src/lib/auction.js` marks a live auction as `"ended"` the moment `now >= end_time`, even when seats aren't full (so it should restart, not end). This makes a tile flash "Ended" then flip back to a live countdown when the page-load sync restarts the timer.

## Changes

### 1. New shared hook — `src/lib/useAuctionCountdown.js`
A small React hook that ticks every second and returns, for a given auction:
- `status` — the **rule-aware** effective status (see #3).
- `remaining` — live ms remaining (for live auctions).
- `durationLabel` — `"Xmin"` config length (only meaningful for open auctions).

### 2. Status-aware clock stat on all cards (the visible fix)
Replace the unconditional `{auction.duration_minutes}{t.auction.minutes}` with:
- **Live** → real-time countdown via `formatCountdown(remaining)` (ticking, like the featured strip). e.g. `48:11:53` instead of `3000min`.
- **Ended** → the localized "Ended" label (no number, no clock-as-timer look).
- **Open (not started)** → the configured round length `Xmin` (this is the only case where showing the duration is correct).

Files:
- `src/components/auctions/MobileAuctionsHub.jsx` — `MobileTile` clock span (line ~265).
- `src/components/AuctionCard.jsx` — desktop card clock span (line ~39).
- `src/components/home/HomeAuctionCard.jsx` — home card clock span (line ~43).

The `MiniCountdown` on the auction detail page already handles ended vs live correctly, so it is left unchanged.

### 3. Rule-aware `effectiveStatus` — `src/lib/auction.js`
When `status === "live"` and the timer has expired, do **not** return `"ended"` unless seats are full. Replicate the seat-quota check (`closeQuota`: `min(min_participants, max_subscribers)`) on the client:
- timer expired **and** seats full → `"ended"` (will settle on next sync).
- timer expired **and** seats not full → `"live"` (timer will restart on next sync; countdown shows `00:00` until sync refreshes it, instead of falsely flashing "Ended").

This keeps the badge and the clock display consistent with the backend restart rule.

## Out of scope / notes
- The backend restart-until-seats-then-settle logic in `handlers.server.ts` is **unchanged** — it already matches the rule you confirmed.
- The "طقم ألماس" auction has `duration_minutes = 3000` (≈50h), which is an admin-configured value. After this fix it shows its real `~48:11:53` countdown instead of the raw `3000min`; the duration itself is not changed.
- No database/data changes. Legacy ended rows (e.g. Rolex, ended with 2/15 seats) will now display cleanly as "Ended" rather than `15min`; they are not auto-reopened.
