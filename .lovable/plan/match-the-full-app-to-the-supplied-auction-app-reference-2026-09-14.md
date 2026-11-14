# Match the full app to the supplied auction-app reference

## Goal
Rebuild the customer-facing experience so every screen follows the reference’s premium native-auction language, while keeping all existing auction, wallet, account, language, and admin behavior unchanged.

## What will change
- Create one consistent visual system: midnight navy background, layered blue-black surfaces, illuminated gold bidding controls and prices, cyan navigation and wallet actions, red live states, and compact white content panels where the reference uses them.
- Rework the mobile shell to closely match the reference: compact top bar, five-tab bottom navigation, safe-area spacing, dense native controls, and no content hidden beneath fixed actions.
- Redesign the public and signed-in home screens with greeting/profile context, search, category shortcuts, featured live auction, winning auctions, balance summary, and compact recent activity.
- Redesign auction discovery into the reference’s searchable list: search field, category/status chips, compact horizontal product rows, favorites, countdowns, and prices.
- Redesign auction detail with a large product stage, live/share controls, illuminated segmented countdown, participant row, dominant price, gold bid action, chat/activity entry, complete bid list, and visible remaining-bid information.
- Redesign login, registration, and verification as native full-screen flows using the same branding, keypad/form rhythm, language support, and clear primary action.
- Redesign wallet, deposit, notifications, and account screens to match the reference’s dense native cards, transaction rows, profile summary, settings list, and light/dark compatibility.
- Bring desktop/tablet versions into the same visual family with wider compositions instead of stretched phone layouts.

## Technical details
- Extend semantic tokens in `src/styles.css`; avoid hardcoded page colors and retain Arabic RTL plus English LTR behavior.
- Refactor shared customer UI first, then update page-specific sections so visual changes remain consistent.
- Preserve current routes, business rules, database calls, admin permissions, and payment behavior.
- Use existing auction/product images and data; the supplied collage remains a visual reference and will not be embedded.

## Verification
- Check every public and signed-in customer route at 393px mobile, tablet width, and 1280px desktop.
- Verify Arabic and English layouts, fixed bid controls, bottom navigation, text wrapping, horizontal overflow, and dark-mode contrast.
- Run focused type checks and browser interaction checks for login, auction browsing, bidding controls, wallet/deposit, and account navigation.
