# Remove the black cards — match the rest of the app

The mobile auctions hub is the only screen still using black cards. The account and wallet screens already share one clean light palette, and the desktop auction card uses it too. The plan is to make the auctions screens use that exact same palette.

## The shared palette (already in use elsewhere)

Taken from the account/wallet screens and the desktop auction card:

- Page background: the light lavender/gray already behind everything
- Cards: white surface, light gray border, soft shadow
- Titles: near-black slate text
- Secondary text: mid gray
- Muted labels: light gray
- Accent: blue for icons and links
- Status chips: green for open, red/rose for live, gray for ended
- Selected filter chip: solid dark pill with white text (keeps the selection obvious without turning cards black)

## What changes

**Mobile auctions hub**
- Featured auction banner: white card with border and soft shadow instead of the black block; live badge becomes a rose chip, price becomes slate text
- Filter chips: white pills with gray borders; only the active chip stays dark for contrast
- Wallet balance pill: white with a blue wallet icon (same as the account page button)
- Sort dropdown: white with a light border
- Auction cards: white surface, light border, soft shadow. Image keeps its current compact height. Title in slate, participants and time in mid gray, price in slate, "View auction" button becomes a dark-on-white pill matching the desktop card
- Image bottom fade removed (it only existed to blend into the black card)
- Loading skeletons and the empty state switch to light gray

**Mobile auction detail**
- The remaining translucent white dividers and card overlays swapped for the light equivalents so the screen reads consistently

**Home auction card**
- Still dark (`#1a1a1a`). Converted to the same white card treatment so no black surfaces remain anywhere.

Card sizes, spacing, image heights, and layout stay exactly as they are now — this is a color-only pass.

## Technical notes

Files touched:
- `src/components/auctions/MobileAuctionsHub.jsx`
- `src/components/auction/MobileAuctionDetail.jsx`
- `src/components/home/HomeAuctionCard.jsx`

Approach: replace `bg-ink-950` / `bg-ink-800` / `bg-[#1a1a1a]` surfaces and `text-white` / `white/xx` text with the same white + slate + blue classes already used in `src/components/AuctionCard.jsx` and `src/components/account/MobileAccount.jsx`, so all three screens stay visually in sync. No logic, data fetching, or layout changes.

Verification: mobile-viewport screenshots of the auctions hub, an auction detail page, and home, checked against the account screen for palette consistency.
