import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "action", label: { en: "Action", ar: "الإجراء" }, required: true },
  { key: "actor_name", label: { en: "Actor", ar: "المُنفِّذ" } },
  { key: "target_type", label: { en: "Target type", ar: "نوع الهدف" } },
  { key: "target_id", label: { en: "Target ID", ar: "معرّف الهدف" } },
  { key: "details", label: { en: "Details", ar: "التفاصيل" }, type: "textarea", hideInTable: true },
];

export default function AdminActivityLogs() {
  return (
    <AdminCrudTable
      entity="ActivityLog"
      title={{ en: "Activity logs", ar: "سجل النشاط" }}
      subtitle={{ en: "Audit trail of admin actions.", ar: "سجل تدقيق الإجراءات الإدارية." }}
      addLabel={{ en: "Log entry", ar: "إضافة سجل" }}
      emptyLabel={{ en: "No activity logged yet.", ar: "لا سجلات بعد." }}
      fields={fields}
    />
  );
}