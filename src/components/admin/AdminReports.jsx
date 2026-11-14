import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const targetOpts = [
  { value: "auction", label: { en: "Auction", ar: "مزاد" } },
  { value: "user", label: { en: "User", ar: "مستخدم" } },
  { value: "bid", label: { en: "Bid", ar: "مزايدة" } },
  { value: "other", label: { en: "Other", ar: "أخرى" } },
];
const statusOpts = [
  { value: "open", label: { en: "Open", ar: "مفتوحة" } },
  { value: "resolved", label: { en: "Resolved", ar: "محلولة" } },
  { value: "dismissed", label: { en: "Dismissed", ar: "مُستبعدة" } },
];

const fields = [
  { key: "target_type", label: { en: "Target type", ar: "نوع الهدف" }, type: "select", options: targetOpts, required: true },
  { key: "target_id", label: { en: "Target ID", ar: "معرّف الهدف" } },
  { key: "target_title", label: { en: "Target", ar: "الهدف" } },
  { key: "reporter_name", label: { en: "Reporter", ar: "المُبلِّغ" } },
  { key: "reason", label: { en: "Reason", ar: "السبب" }, type: "textarea", hideInTable: true },
  { key: "status", label: { en: "Status", ar: "الحالة" }, type: "select", options: statusOpts, required: true },
  { key: "resolution_note", label: { en: "Resolution note", ar: "ملاحظة الحل" }, type: "textarea", hideInTable: true },
];

export default function AdminReports() {
  return (
    <AdminCrudTable
      entity="Report"
      title={{ en: "Reported items", ar: "العناصر المُبلَّغ عنها" }}
      subtitle={{ en: "Moderation queue for flagged content.", ar: "قائمة مراجعة المحتوى المُبلَّغ عنه." }}
      addLabel={{ en: "Add report", ar: "إضافة بلاغ" }}
      emptyLabel={{ en: "No reports yet.", ar: "لا بلاغات بعد." }}
      fields={fields}
    />
  );
}