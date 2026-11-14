# Redesign the full Mazady system from the reference

## Direction
Rebuild the customer and admin experience around the supplied premium auction-app reference. The uploaded collage is a visual reference only and will not be embedded in the product.

- Deep midnight-navy canvas with layered navy surfaces
- Warm gold for bidding, prices, primary actions, and premium emphasis
- Cyan for navigation, wallet, filters, and secondary actions
- White text, cool gray supporting copy, rose for live/urgent states, green for success
- Compact native-app hierarchy, strong product photography, illuminated countdowns, clear monetary values
- Arabic and English remain fully supported with correct RTL/LTR behavior
- Mobile becomes the primary experience; desktop expands the same visual language rather than becoming a different product

## What will change

### 1. Shared design system
- Replace the current light blue/white and legacy neon palette with semantic navy, gold, cyan, status, border, and elevation tokens.
- Update shared buttons, cards, inputs, sheets, dialogs, tabs, badges, tables, loading states, and focus states.
- Keep colors theme-driven so dark surfaces remain readable throughout customer and admin screens.
- Standardize compact radii, thin luminous borders, restrained shadows, and native touch targets.

### 2. App shell and navigation
- Rebuild the mobile header and five-tab navigation to match the reference’s native dark shell with cyan active states.
- Restyle the desktop header as a premium auction command bar using the same hierarchy.
- Improve safe-area spacing, sticky behavior, RTL alignment, icons, selected states, and notification/wallet affordances.

### 3. Authentication and public entry
- Redesign login, registration, password recovery/reset, and public home as immersive navy screens.
- Use a focused auction-brand presentation, premium gold action buttons, clearer fields, and polished mobile full-screen flows.
- Preserve all current authentication logic and bilingual content.

### 4. Customer screens
- Home: premium wallet summary, live auction feature, compact category/actions, auction rows, activity and personal status.
- Discover/Auctions: searchable/filterable native list on phones and a dense responsive catalogue on desktop.
- Auction details: product-first gallery, live status, illuminated countdown, price hierarchy, participant strip, bid history, and an accessible bid action that never covers content.
- Wallet/Deposit: dark financial dashboard, clear balance, funding actions, transaction states, and confirmation flow.
- Account, notifications, My Bids, winner/payment, legal pages: one consistent native visual language.

### 5. Admin system
- Convert the sidebar, top bar, grouped navigation, overview cards, charts, forms, dialogs, tables, status chips, and pagination to the same navy/gold/cyan system.
- Preserve dense information and business readability; admin tables will use dark layered rows and clear semantic status colors instead of decorative styling.
- Ensure mobile admin navigation remains usable through the existing drawer pattern.

### 6. Responsive and accessibility pass
- Verify phone widths at 393px and 528px, tablet, and desktop at 1280px.
- Check every primary route for clipping, covered controls, readable contrast, keyboard focus, reduced motion, and RTL/LTR parity.
- Keep existing auction, wallet, payment, role, and backend behavior unchanged.

## Implementation approach
1. Establish the shared tokens and base components first.
2. Redesign the global customer/admin shells.
3. Apply the system to authentication and public entry screens.
4. Apply it to core customer journeys: Home → Auctions → Detail → Bid → Wallet/Deposit → Account.
5. Apply it to admin navigation and representative shared list/form/chart patterns so all admin sections inherit the redesign.
6. Remove remaining hardcoded light-theme colors and legacy neon styling from active screens.
7. Run focused checks and visual browser verification across mobile and desktop.

## Acceptance checks
- The first mobile viewport clearly resembles the supplied reference in palette, density, hierarchy, and native-app polish.
- No white/light page remains visually disconnected from the new system.
- Gold is reserved for high-value bid actions and prices; cyan supports navigation and secondary actions.
- Bid controls never obscure leaderboards or activity.
- All existing flows and bilingual behavior continue working.
- Primary customer and admin routes render without errors or horizontal overflow.
