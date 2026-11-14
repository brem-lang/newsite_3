import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const channelOpts = [
  { value: "email", label: { en: "Email", ar: "بريد" } },
  { value: "sms", label: { en: "SMS", ar: "رسالة نصية" } },
  { value: "inapp", label: { en: "In-app", ar: "داخل التطبيق" } },
  { value: "whatsapp", label: { en: "WhatsApp", ar: "واتساب" } },
];

const fields = [
  { key: "key", label: { en: "Key", ar: "المعرّف" }, required: true },
  { key: "channel", label: { en: "Channel", ar: "القناة" }, type: "select", options: channelOpts, required: true },
  { key: "subject", label: { en: "Subject", ar: "الموضوع" } },
  { key: "body", label: { en: "Body", ar: "النص" }, type: "textarea", rows: 6, hideInTable: true },
  { key: "variables", label: { en: "Variables", ar: "المتغيرات" } },
  { key: "active", label: { en: "Active", ar: "مفعّل" }, type: "boolean" },
];

export default function AdminTemplates() {
  return (
    <AdminCrudTable
      entity="Template"
      title={{ en: "Message templates", ar: "قوالب الرسائل" }}
      subtitle={{ en: "Customize automated email/SMS/in-app templates.", ar: "تخصيص قوالب البريد والرسائل والإشعارات." }}
      addLabel={{ en: "New template", ar: "قالب جديد" }}
      emptyLabel={{ en: "No templates yet.", ar: "لا قوالب بعد." }}
      fields={fields}
    />
  );
}