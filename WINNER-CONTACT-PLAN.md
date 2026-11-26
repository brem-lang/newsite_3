# Contacting winners: email, phone and WhatsApp (plan)

Status: **not started** (2026-11-26). Today only **in-app** notifications reach
a member. This plan covers the channels to set up later.

## Where things stand

| Channel | What happens today | Reaches the member? |
|---|---|---|
| In-app | `notifications` row, `channel: "inapp"`; shown in the bell (desktop and mobile home) | **Yes** |
| Email | `emailUser()` in `supabase/functions/api/handlers.ts` and `sendEmail()` in `src/lib/messaging.js` only insert a `notifications` row with `channel: "email"` | **No**: no provider is connected |
| WhatsApp | `sendWhatsApp()` inserts a row with `channel: "whatsapp", status: "pending"` | **No** |
| Phone | Shown in Results (contact dialog) and Participants → detail only | Admin dials it by hand |

Places that already *try* to email: the "You won" message (settlement and
runner-up promotion), "Delivery update", verification and refund decisions,
Admin → Results "Contact winner", and Admin → Broadcast.

Available now (built 2026-11-26): **Send in-app** in Results → Contact winner,
and a **Remind to pay** button (in-app) in Results, Winner payments and
Fulfilment.

## Phase 1: one-click contact in admin (no provider needed)

Show the winner's email and phone, each with an action, on **Results**,
**Winner payments** and **Fulfilment**:

- Email: `mailto:` link (opens the admin's own mail app).
- Call: `tel:` link.
- WhatsApp: `https://wa.me/<digits>?text=<message>` (opens WhatsApp on the
  admin's device; a pre-filled payment message with the `/pay/<token>` link).
- The winner's name opens Participants → detail.
- Fulfilment: show the delivery phone (`address_phone`) in the address column.

Data: `useAdminUsersByIds(ids, "*")` already returns `email` and `phone`;
Winner payments and Fulfilment currently request only label fields.

Phone numbers are stored as `"+<code> <digits>"` (see `Register.jsx`), so
`wa.me` needs the digits only (`phone.replace(/\D/g, "")`).

## Phase 2: real email

1. Pick a provider: **Resend** (simplest API, free tier) or SendGrid /
   Postmark. Needs an account, a verified sending domain (SPF + DKIM DNS
   records) and an API key.
2. Store the key as an edge function secret
   (`supabase secrets set RESEND_API_KEY=…`), never in the front end.
3. Make `emailUser()` actually send (one `fetch` to the provider), then keep
   the `notifications` row as the delivery log, with `status: "sent"` or
   `"failed"` plus the provider's error.
4. Point `src/lib/messaging.js#sendEmail` at the same server path (it already
   calls the `sendEmail` action) so admin emails go out too.
5. Templates: plain text first; an HTML layout with the brand later
   (Admin → Templates already exists for the copy).
6. Add an unsubscribe/footer line for broadcast email (marketing mail needs it;
   transactional mail such as "You won" doesn't).
7. Deploy: secret → edge function → front end. No database change.

## Phase 3: WhatsApp

Options, simplest first:

1. **Click-to-chat only** (Phase 1): no API, the admin sends from their phone.
2. **WhatsApp Business Cloud API** (Meta) or **Twilio WhatsApp**: needs a
   business account, an approved sender number and **pre-approved message
   templates** for messages sent outside a 24-hour customer window (a "You
   won" / payment reminder is exactly that case).
3. Then: a `sendWhatsApp` server action using the provider, turning the
   existing `pending` rows into `sent` / `failed`, same as email.

Members must agree to WhatsApp messages: add a consent checkbox at sign-up
or in the account settings before sending automated WhatsApp messages.

## Phase 4: SMS (optional)

Same shape as email with Twilio / Vonage, for members without WhatsApp. Only
worth it if winners are often unreachable.

## Open decisions

- Which email provider, and which domain to send from.
- Whether WhatsApp is click-to-chat only, or automated (needs Meta approval).
- Should the "You won" message go out on every channel automatically, or
  in-app + email only, with WhatsApp sent by an admin?
