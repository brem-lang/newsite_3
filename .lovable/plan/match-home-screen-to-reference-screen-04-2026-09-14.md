# Match Home Screen to Reference Screen 04

## Goal
Rebuild the signed-in mobile home screen to closely match screen 04 of the supplied MIZAD reference while preserving all auction, wallet, navigation, language, and authentication behavior.

## Changes
- Recreate the screen 04 top area with the MIZAD identity, greeting, notification/language actions, and compact wallet balance treatment.
- Replace the current generic home arrangement with the reference hierarchy: featured live auction first, clear countdown and price emphasis, participant progress, and gold primary action.
- Restyle secondary live auctions and the user's auction activity into compact native rows matching the reference spacing, borders, typography, and icon treatment.
- Keep the five-tab mobile navigation aligned with the screen 04 visual treatment and safe-area spacing.
- Adapt the same visual language for tablet and desktop without changing the existing desktop information or business logic.
- Preserve Arabic RTL, English LTR, live data, links, refresh behavior, and empty/loading states.

## Validation
- Compare the finished page at 393px against screen 04.
- Check Arabic and English layouts for clipping or horizontal overflow.
- Verify auction cards, wallet/deposit navigation, notifications, and bottom tabs remain usable.
- Verify desktop layout and route rendering remain intact.
