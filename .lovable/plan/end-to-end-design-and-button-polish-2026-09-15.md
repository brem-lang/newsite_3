# End-to-end design and button polish

## Goal
Make the full customer and admin experience feel like one premium native auction app, matching the approved deep-navy, gold, and cyan reference across mobile and desktop.

## What will change

### 1. Unify every button and interactive control
- Consolidate the duplicated shared button definitions into one visual contract.
- Standardize primary gold, secondary cyan, outline, ghost, destructive, link, and icon-only controls.
- Give controls consistent heights, corner radius, icon sizing, disabled/loading states, focus rings, press feedback, and hover treatment.
- Replace visible raw HTML buttons with the shared control where practical, including admin navigation, wallet choices, filters, dialogs, and auction actions.

### 2. Strengthen the shared visual system
- Refine navy surfaces, gold/cyan emphasis, borders, shadows, inputs, panels, badges, tabs, and navigation using semantic theme tokens.
- Remove the remaining legacy light-palette compatibility styling from visible screens where it weakens the reference look.
- Keep red only for live/destructive states and green only for confirmed/success states.

### 3. Polish customer screens end to end
- Align public Home, signed-in Home, Auctions, Auction Detail, bid confirmation, Results, Wallet, Deposit, Account, Auth, Notifications, and Legal pages.
- Standardize page headers, section spacing, cards, image treatment, price hierarchy, auction status, empty/loading states, and bottom actions.
- Preserve all current auction, wallet, registration, bid, and payment behavior.

### 4. Polish admin screens end to end
- Apply the same navy/gold/cyan language to the admin shell, sidebar, mobile drawer, tabs, tables, filters, forms, dialogs, pagination, and action buttons.
- Improve dense-list readability without changing permissions or business logic.
- Make create, edit, start, close, approve, export, and destructive actions visually distinct and consistent.

### 5. Responsive and interaction validation
- Check signed-out and signed-in customer flows at phone and desktop sizes.
- Check key admin pages at phone and desktop sizes.
- Verify no horizontal clipping, covered actions, unreadable text, broken focus states, or inconsistent button states.
- Confirm primary routes load and run focused type/style checks.

## Technical details
- Keep all colors and shadows in `src/styles.css` semantic tokens and utilities.
- Keep the existing bilingual RTL/LTR behavior and English-number formatting.
- Use the existing shared `Button` component for commands; links remain links but receive matching action styles.
- No database, permissions, auction rules, wallet calculations, or payment-flow changes.
