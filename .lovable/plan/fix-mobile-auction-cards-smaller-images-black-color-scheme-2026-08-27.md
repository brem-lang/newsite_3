# Fix mobile auction cards: smaller images + black color scheme

## What you asked
1. Auction card images are too tall on mobile — make them smaller.
2. Replace the lime-green accents with black, matching the profile/account page style.

## Root cause of the tall images
The auction carousel in `MobileAuctionsHub.jsx` uses `flex-1` to stretch cards to fill all leftover screen height, and each card's image area uses `flex-1 min-h-[150px]`, so on tall phone screens the image balloons to fill the space.

## Changes

### 1. Card + image sizing — `src/components/auctions/MobileAuctionsHub.jsx`
- Carousel row: stop stretching to full height; give cards a fixed compact height (~300px) instead of `h-full`.
- `MobileTile` image area: replace `flex-1 min-h-[150px]` with a fixed height (~140px) so images stay small and consistent.
- Same fix for the loading skeleton cards.

### 2. Lime → black (matching the profile page palette)
The profile page uses plain black/white/gray (`bg-card`, `border-border`, dark text) with no neon colors. Replace every `neon-lime` usage in the mobile auction UI with a monochrome scheme:
- `bg-neon-lime text-ink-950` badges/buttons (LIVE badge, entry-fee badge, "View auction" button, active filter chip) → `bg-white text-ink-950` on dark cards, or `bg-ink-950 text-white` where it sits on the light background.
- `text-neon-lime` prices, icons, wallet balance → `text-white` on dark surfaces / `text-foreground` (black) on light surfaces.
- Seats progress bar gradient `from-pink-500 to-neon-lime` → solid black-to-gray (`from-ink-950 to-ink-950` on light, or white on the dark card).
- Files: `src/components/auctions/MobileAuctionsHub.jsx` and `src/components/auction/MobileAuctionDetail.jsx` (the auction detail screen uses the same lime accents).

### 3. Keep as-is
- Light lavender page background stays.
- Dark card surfaces (`bg-ink-950`) stay — only the lime accents go black/white.
- Orange "your bid" text stays (it's not lime).

## Verification
Playwright mobile viewport (393px): check `/auctions` cards are compact with small images, and confirm no lime remains on hub + auction detail.
