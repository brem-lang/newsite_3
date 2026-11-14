import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "name", label: { en: "Name" }, required: true },
  { key: "key", label: { en: "API key" }, required: true },
  { key: "scopes", label: { en: "Scopes" } },
  { key: "last_used", label: { en: "Last used" } },
  { key: "active", label: { en: "Active" }, type: "boolean" },
];

export default function AdminApiKeys() {
  return (
    <AdminCrudTable
      entity="ApiKey"
      title={{ en: "API keys" }}
      subtitle={{ en: "Manage third-party integration keys." }}
      addLabel={{ en: "Add key" }}
      emptyLabel={{ en: "No API keys yet." }}
      fields={fields}
    />
  );
}