// Legal copy for the Terms of Service and Privacy Policy pages.
// Plain data so both the mobile (native-style) and desktop layouts render
// the same sections.

export const LEGAL_UPDATED = "2026-09-08";

export const legalContent = {
  terms: {
    en: {
      title: "Terms of Service",
      subtitle: "The rules for joining auctions, paying entry fees and bidding.",
      updatedLabel: "Last updated",
      intro:
        "These terms are an agreement between you and Mazady. By creating an account, adding funds or joining an auction you accept them. If you do not agree, please do not use the platform.",
      sections: [
        {
          id: "eligibility",
          heading: "1. Who can take part",
          body: [
            "You must be at least 18 years old and legally able to enter a contract.",
            "One account per person. Accounts created with false details, or several accounts used by the same person to gain an advantage, may be suspended and their balance frozen while we review.",
            "You are responsible for keeping your password safe and for everything done through your account.",
          ],
        },
        {
          id: "entry",
          heading: "2. Joining an auction",
          body: [
            "Each auction shows a fixed entry fee and the number of seats available before you join.",
            "The entry fee is taken from your wallet balance the moment you reserve a seat.",
            "Joining gives you a seat and a number of bids for that auction. It does not guarantee that you will win.",
            "An auction starts its countdown once the required number of seats is filled.",
          ],
        },
        {
          id: "bidding",
          heading: "3. Bidding and winning",
          body: [
            "Bids are final and cannot be withdrawn once submitted.",
            "In closest-price auctions the winner is the participant whose unique bid is closest to the selling price without exceeding it. If two or more participants submit the same value, that value is cancelled for everyone.",
            "In ascending auctions the highest valid bid when the timer ends wins.",
            "You may run out of included bids and choose to buy extra bids. Extra bids are paid from your wallet and are used immediately.",
            "We may extend a countdown slightly when bids arrive in the final seconds, so that no one wins purely on timing.",
          ],
        },
        {
          id: "wallet",
          heading: "4. Wallet, fees and payments",
          body: [
            "Your wallet balance is a prepaid credit used only inside the platform. It is not a bank account, it earns no interest and it has no value outside the platform.",
            "Top-ups may be made by the payment methods shown on the deposit screen. Some methods are reviewed by our team before the balance appears.",
            "Entry fees and bid fees are consumed when used and are not refundable once an auction has started.",
            "If you win, we send you a payment link for the remaining amount of the item. Ownership passes only after that payment clears.",
            "Prices are shown in the currency displayed on screen. Bank or card charges from your provider are your responsibility.",
          ],
        },
        {
          id: "refunds",
          heading: "5. Cancellations and refunds",
          body: [
            "If we cancel or void an auction before it starts, entry fees for that auction are returned to your wallet.",
            "You can request a refund of an unused top-up from the wallet screen. We may ask you to confirm your identity first.",
            "Refunds are returned to the original payment method where possible, otherwise as wallet balance.",
          ],
        },
        {
          id: "conduct",
          heading: "6. Fair use",
          body: [
            "Do not use bots, scripts or automated tools to bid, and do not attempt to interfere with the auction engine.",
            "Do not coordinate with other participants to manipulate an outcome, and do not harass other users in chat.",
            "We may suspend or close accounts, cancel bids and withhold prizes where we find manipulation, fraud or abuse.",
          ],
        },
        {
          id: "liability",
          heading: "7. Availability and liability",
          body: [
            "We work to keep the platform available but cannot promise uninterrupted service. Maintenance, outages or network issues may affect access.",
            "Where an auction is clearly affected by a technical fault, we may void it and return the entry fees for that auction.",
            "To the extent permitted by law, our responsibility to you is limited to the amounts you paid us in connection with the affected auction.",
          ],
        },
        {
          id: "changes",
          heading: "8. Changes and contact",
          body: [
            "We may update these terms. Material changes will be announced in the app, and continuing to use the platform means you accept the updated terms.",
            "Questions about these terms can be sent to our support team from the account screen.",
          ],
        },
      ],
    },
  },

  privacy: {
    en: {
      title: "Privacy Policy",
      subtitle: "What we collect, why we need it and the choices you have.",
      updatedLabel: "Last updated",
      intro:
        "We only collect what we need to run auctions, process wallet transactions and keep the platform fair. We never sell your personal data.",
      sections: [
        {
          id: "collect",
          heading: "1. Information we collect",
          body: [
            "Account details you give us: first and last name, email address, phone number and country.",
            "Activity created by using the app: auctions you join, bids you place, wallet transactions, notifications and support messages.",
            "Technical data: device type, browser, language, approximate country from your IP address, and log records used to detect abuse.",
          ],
        },
        {
          id: "use",
          heading: "2. How we use it",
          body: [
            "To create and secure your account and to sign you in.",
            "To run auctions: seats, bid quotas, winner selection and payment of prizes.",
            "To process top-ups, entry fees, extra bids and refunds.",
            "To send you service messages such as bid alerts, round starts, winner notices and password resets.",
            "To detect fraud, duplicate accounts and manipulation, and to meet legal or accounting obligations.",
          ],
        },
        {
          id: "visibility",
          heading: "3. What other users can see",
          body: [
            "Other participants in an auction can see a shortened form of your name (for example a first name and an initial) together with your bids in that auction.",
            "Your email address, phone number, wallet balance and transaction history are never shown to other users.",
          ],
        },
        {
          id: "sharing",
          heading: "4. Who we share it with",
          body: [
            "Service providers who host the platform, send email and process card payments, strictly to perform those services for us.",
            "Authorities, where we are required to by law or to protect our rights.",
            "We do not sell your personal data and we do not share it for third-party advertising.",
          ],
        },
        {
          id: "retention",
          heading: "5. How long we keep it",
          body: [
            "Account and auction records are kept while your account is active.",
            "Financial records such as top-ups, entry fees and prize payments are kept for as long as accounting and legal rules require, even after an account is closed.",
            "Technical logs are kept for a short period and then deleted or anonymised.",
          ],
        },
        {
          id: "rights",
          heading: "6. Your choices",
          body: [
            "You can view and edit your profile details at any time from the account screen.",
            "You can ask us for a copy of your data, ask us to correct it, or ask us to delete your account and associated data. Financial records we must keep by law are an exception.",
            "You can turn service notifications off on your device, though important account and auction messages may still be sent by email.",
          ],
        },
        {
          id: "security",
          heading: "7. Security and contact",
          body: [
            "Data is transmitted over encrypted connections, passwords are stored hashed, and access to production data is restricted to authorised staff.",
            "No system is perfectly secure, so please use a strong, unique password and tell us straight away if you suspect unauthorised access.",
            "For any privacy request, contact our support team from the account screen.",
          ],
        },
      ],
    },
  },
};

export function getLegalDoc(kind) {
  const doc = legalContent[kind] || legalContent.terms;
  return doc.en;
}

const slugify = (s, i) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `section-${i + 1}`;

/**
 * Turn a published CMS page (admin → Pages) into the same shape as the
 * built-in docs above, so LegalPage renders both the same way.
 *
 * Body format (plain text):
 *   Text before the first heading is the intro.
 *   "## Heading" starts a section.
 *   Every other non-empty line in a section is one bullet ("- " is optional).
 */
export function pageToDoc(row, fallback = null) {
  const intro = [];
  const sections = [];
  let current = null;
  String(row?.body_en || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      const heading = line.match(/^#{1,3}\s+(.*)$/);
      if (heading) {
        current = { id: slugify(heading[1], sections.length), heading: heading[1].trim(), body: [] };
        sections.push(current);
        return;
      }
      const text = line.replace(/^[-*•]\s+/, "");
      if (current) current.body.push(text);
      else intro.push(text);
    });
  // No headings at all: the first paragraph is the intro, the rest one section.
  if (!sections.length && intro.length > 1) {
    sections.push({ id: "section-1", heading: "", body: intro.splice(1) });
  }
  return {
    title: (row?.title_en || "").trim() || fallback?.title || row?.slug || "",
    subtitle: fallback?.subtitle || "",
    updatedLabel: fallback?.updatedLabel || "Last updated",
    intro: intro.join(" "),
    sections,
  };
}

/**
 * The CMS pages the site has a route for. admin → Pages offers exactly these
 * slugs; each shows at /<slug>. `builtIn` pages fall back to the copy above
 * when nothing is published; the others are linked only once published.
 */
export const SITE_PAGES = [
  { slug: "terms", label: "Terms of Service", builtIn: true },
  { slug: "privacy", label: "Privacy Policy", builtIn: true },
  { slug: "about", label: "About us", builtIn: false },
  { slug: "faq", label: "FAQ", builtIn: false },
];
