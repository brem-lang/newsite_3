# Screen 08 — Admin Profile & Settings

## Goal
Create one polished admin settings experience that feels like screens 04 and 06 on phone and desktop, while preserving the existing secure admin access and settings behavior.

## What will change
- Add an **Admin profile** area with the signed-in admin’s initials, name, email, role/super-admin status, verification state, country, and member date.
- Allow the admin to update their personal contact details using the existing validated profile flow.
- Add a dedicated **Security** panel for changing the current password, with show/hide controls and clear success or error states.
- Restyle **General settings** into native navy panels with cyan field focus, gold save actions, compact currency/timezone selectors, and a clear maintenance-mode control.
- Make the screen phone-first: stacked sections, large touch targets, safe spacing, and a persistent visual save state; use a balanced two-column arrangement on desktop.
- Keep the screen fully bilingual with correct RTL/LTR behavior and English-formatted numbers.

## Navigation and access
- Keep the existing protected `/admin/settings` destination and `system.manage` permission requirement.
- Add profile/security tabs inside that destination rather than creating disconnected pages.
- Reuse the existing admin shell, language switcher, and logout controls.

## Technical details
- Reuse the current authenticated profile update and password-change functions; no new database tables or permission changes.
- Continue saving site identity, currency, timezone, and maintenance settings through the existing site-settings record.
- Add complete English and Arabic labels for every new tab, status, field, and action.
- Use only the existing semantic navy/gold/cyan design tokens and shared Button/Input controls.

## Verification
- Check profile edits, password validation, general-settings save, and maintenance toggle behavior.
- Verify `/admin/settings` at 393px and 1280px, including RTL, no clipping, and readable dark-theme states.
- Confirm protected access remains unchanged and the page loads without console errors.
