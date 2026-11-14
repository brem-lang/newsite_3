import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const targetOpts = [
  { value: "auction", label: { en: "Auction" } },
  { value: "user", label: { en: "User" } },
  { value: "bid", label: { en: "Bid" } },
  { value: "other", label: { en: "Other" } },
];
const statusOpts = [
  { value: "open", label: { en: "Open" } },
  { value: "resolved", label: { en: "Resolved" } },
  { value: "dismissed", label: { en: "Dismissed" } },
];

const fields = [
  { key: "target_type", label: { en: "Target type" }, type: "select", options: targetOpts, required: true },
  { key: "target_id", label: { en: "Target ID" } },
  { key: "target_title", label: { en: "Target" } },
  { key: "reporter_name", label: { en: "Reporter" } },
  { key: "reason", label: { en: "Reason" }, type: "textarea", hideInTable: true },
  { key: "status", label: { en: "Status" }, type: "select", options: statusOpts, required: true },
  { key: "resolution_note", label: { en: "Resolution note" }, type: "textarea", hideInTable: true },
];

export default function AdminReports() {
  return (
    <AdminCrudTable
      entity="Report"
      title={{ en: "Reported items" }}
      subtitle={{ en: "Moderation queue for flagged content." }}
      addLabel={{ en: "Add report" }}
      emptyLabel={{ en: "No reports yet." }}
      fields={fields}
    />
  );
}