import { base44 } from "@/api/base44Client";

// Send an in-app notification (creates a Notification record, channel=inapp).
// `extra` adds fields such as auction_id (the bell opens that auction).
export async function sendInApp(user, title, body, type = "info", extra = {}) {
  return base44.entities.Notification.create({
    user_id: user.id,
    title,
    body,
    channel: "inapp",
    type,
    status: "sent",
    read: false,
    ...extra
  });
}

/**
 * In-app payment reminder for a win. The message ends with the same
 * "Complete your payment here: /pay/<token>" line as the win notification,
 * so the member's bell shows "Pay now" (until they send their delivery
 * details or the payment is marked paid).
 */
export async function sendPaymentReminder({ userId, payment, auctionTitle, auctionId, currency = "" }) {
  const amount = `${currency}${Number(payment?.amount || 0).toFixed(2)}`;
  const link = payment?.token ? ` Complete your payment here: /pay/${payment.token}` : "";
  const body = `Your payment of ${amount} for "${auctionTitle || "your auction"}" is still due. Send your delivery details if you haven't yet, and our team will confirm the payment with you.${link}`;
  return sendInApp({ id: userId }, "Payment reminder", body, "warning", { auction_id: auctionId || payment?.auction_id || null });
}

// Send an email to a registered user + log a Notification record (channel=email).
export async function sendEmail(user, subject, body) {
  await base44.integrations.Core.SendEmail({ to: user.email, subject, body });
  return base44.entities.Notification.create({
    user_id: user.id,
    title: subject,
    body,
    channel: "email",
    recipient: user.email,
    status: "sent",
    read: true
  });
}

// Queue a WhatsApp message. Delivery requires a connected WhatsApp channel;
// until then the message is logged as a pending Notification.
export async function sendWhatsApp(user, title, body) {
  return base44.entities.Notification.create({
    user_id: user.id,
    title,
    body,
    channel: "whatsapp",
    recipient: user.phone || "",
    status: "pending",
    read: true
  });
}