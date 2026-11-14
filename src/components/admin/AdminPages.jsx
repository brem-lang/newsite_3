import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "slug", label: { en: "Slug", ar: "المعرّف" }, required: true },
  { key: "title_en", label: { en: "Title (EN)", ar: "العنوان (EN)" } },
  { key: "title_ar", label: { en: "Title (AR)", ar: "العنوان (AR)" } },
  { key: "body_en", label: { en: "Body (EN)", ar: "النص (EN)" }, type: "textarea", rows: 6, hideInTable: true },
  { key: "body_ar", label: { en: "Body (AR)", ar: "النص (AR)" }, type: "textarea", rows: 6, hideInTable: true },
  { key: "published", label: { en: "Published", ar: "منشور" }, type: "boolean" },
];

export default function AdminPages() {
  return (
    <AdminCrudTable
      entity="Page"
      title={{ en: "Pages (CMS)", ar: "الصفحات (CMS)" }}
      subtitle={{ en: "Edit legal and content pages (Terms, Privacy, About, FAQ).", ar: "تحرير صفحات المحتوى والقانونية." }}
      addLabel={{ en: "New page", ar: "صفحة جديدة" }}
      emptyLabel={{ en: "No pages yet.", ar: "لا صفحات بعد." }}
      fields={fields}
    />
  );
}