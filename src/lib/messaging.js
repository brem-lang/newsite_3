import { base44 } from "@/api/base44Client";

// Send an in-app notification (creates a Notification record, channel=inapp).
export async function sendInApp(user, title, body, type = "info") {
  return base44.entities.Notification.create({
    user_id: user.id,
    title,
    body,
    channel: "inapp",
    type,
    status: "sent",
    read: false
  });
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