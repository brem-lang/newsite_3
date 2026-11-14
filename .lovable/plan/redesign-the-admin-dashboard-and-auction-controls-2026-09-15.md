# Redesign the admin dashboard and auction controls

## Goal
Bring the admin overview and auction management into the same deep-navy, gold, and cyan visual language as screen 04, while keeping the existing role permissions and auction rules intact.

## What will change
- Restyle the admin shell, navigation, top bar, overview cards, charts, activity panels, and auction list with the existing navy/gold/cyan design tokens.
- Add prominent, permission-safe shortcuts for creating a new auction and opening live-auction management.
- Make auction rows easier to scan on desktop and mobile, with clearer status, pricing, seats, home visibility, edit, start, and close actions.
- Keep the existing auction form, but polish its sections and controls to match the native visual system.
- Close auctions through the existing secured auction update flow, with confirmation and visible success/error feedback.
- Preserve existing admin capability checks, data calculations, and automatic auction lifecycle behavior.

## Verification
- Verify creating, editing, starting, and closing controls are present and connected.
- Check the admin dashboard and auction list at phone and desktop sizes.
- Confirm no horizontal clipping, missing controls, or browser errors.
