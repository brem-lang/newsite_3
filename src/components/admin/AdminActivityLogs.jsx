import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "action", label: { en: "Action" }, required: true },
  { key: "actor_name", label: { en: "Actor" } },
  { key: "target_type", label: { en: "Target type" } },
  { key: "target_id", label: { en: "Target ID" } },
  { key: "details", label: { en: "Details" }, type: "textarea", hideInTable: true },
];

export default function AdminActivityLogs() {
  return (
    <AdminCrudTable
      entity="ActivityLog"
      title={{ en: "Activity logs" }}
      subtitle={{ en: "Audit trail of admin actions." }}
      addLabel={{ en: "Log entry" }}
      emptyLabel={{ en: "No activity logged yet." }}
      fields={fields}
    />
  );
}