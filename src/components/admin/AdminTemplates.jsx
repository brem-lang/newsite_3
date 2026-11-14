import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const channelOpts = [
  { value: "email", label: { en: "Email" } },
  { value: "sms", label: { en: "SMS" } },
  { value: "inapp", label: { en: "In-app" } },
  { value: "whatsapp", label: { en: "WhatsApp" } },
];

const fields = [
  { key: "key", label: { en: "Key" }, required: true },
  { key: "channel", label: { en: "Channel" }, type: "select", options: channelOpts, required: true },
  { key: "subject", label: { en: "Subject" } },
  { key: "body", label: { en: "Body" }, type: "textarea", rows: 6, hideInTable: true },
  { key: "variables", label: { en: "Variables" } },
  { key: "active", label: { en: "Active" }, type: "boolean" },
];

export default function AdminTemplates() {
  return (
    <AdminCrudTable
      entity="Template"
      title={{ en: "Message templates" }}
      subtitle={{ en: "Customize automated email/SMS/in-app templates." }}
      addLabel={{ en: "New template" }}
      emptyLabel={{ en: "No templates yet." }}
      fields={fields}
    />
  );
}