# Mega profile + phone at signup

## What you get

**1. A real profile section (mobile + desktop)**

Today the profile is a small form (name, WhatsApp, address) hidden inside a dialog together with the password form. It becomes a proper "mega profile":

- **Identity header** — initials avatar, full name, email, country flag/name, member-since date, and a verification badge (verified / pending / unverified) plus a Super Admin badge when applicable.
- **Personal details card** — First name, Last name, Email (read-only, with a note that email can't be changed here), Phone number (country code + number), WhatsApp number (with "same as phone" shortcut), Country (searchable select).
- **Address card** — line 1, line 2, city, state, country, ZIP.
- **Security card** — opened by its own key icon/button, separate from personal details: change password (current, new, confirm) as it works today.
- **Account info strip** — read-only: account ID short code, wallet balance link, joined date, verification note if the admin left one.
- Each card saves independently with inline validation and a toast, so a bad address can't block saving your name.

**2. Phone number at registration**

The signup form gains a required phone field: country dialling code pre-selected from the IP-detected country, plus the number. It is validated (digits, min length) and stored on the new user's profile as phone + WhatsApp country code/number, so the profile is populated from day one.

## Technical notes

- No database changes needed: `profiles` already has `first_name`, `last_name`, `phone`, `whatsapp_country_code`, `whatsapp_number`, `country`, `country_code`, `address_*`, `verification_status`, `verification_note`, `is_super`, `created_date`.
- `src/components/account/ProfileDetails.jsx` is rewritten into a multi-card profile: `ProfileHeaderCard`, `PersonalDetailsCard`, `AddressCard`, `AccountInfoCard` (new files under `src/components/account/profile/`), composed by a `ProfileSection.jsx`.
- `src/pages/Account.jsx` renders `ProfileSection` in a two-column layout; `src/components/account/MobileAccount.jsx` renders it stacked inside the existing sheet/dialog, with the password card behind its own key icon instead of always visible.
- Saves keep using `base44.entities.User.update(user.id, payload)`; full_name is derived from first + last name to stay consistent with existing displays.
- Registration: `src/pages/Register.jsx` adds phone country code (derived from `src/lib/countries.js` — a dial-code map is added there) + number; `base44.auth.register` in `src/api/base44Client.ts` passes `phone`, `whatsapp_country_code`, `whatsapp_number` in signup metadata.
- One migration updates `handle_new_user()` to copy those three metadata keys into `public.profiles` on signup (function replacement only, no table/RLS change).
- All new labels added to `src/lib/i18n.jsx` in English and Arabic; styling uses existing semantic tokens (no black buttons, light lavender surfaces).
