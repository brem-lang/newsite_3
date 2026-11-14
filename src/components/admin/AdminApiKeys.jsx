import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "name", label: { en: "Name", ar: "الاسم" }, required: true },
  { key: "key", label: { en: "API key", ar: "المفتاح" }, required: true },
  { key: "scopes", label: { en: "Scopes", ar: "النطاقات" } },
  { key: "last_used", label: { en: "Last used", ar: "آخر استخدام" } },
  { key: "active", label: { en: "Active", ar: "مفعّل" }, type: "boolean" },
];

export default function AdminApiKeys() {
  return (
    <AdminCrudTable
      entity="ApiKey"
      title={{ en: "API keys", ar: "مفاتيح API" }}
      subtitle={{ en: "Manage third-party integration keys.", ar: "إدارة مفاتيح التكامل." }}
      addLabel={{ en: "Add key", ar: "إضافة مفتاح" }}
      emptyLabel={{ en: "No API keys yet.", ar: "لا مفاتيح بعد." }}
      fields={fields}
    />
  );
}