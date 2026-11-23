import React from "react";
import AdminCrudTable, { prefetchCrud } from "./AdminCrudTable";

const fields = [
  { key: "slug", label: { en: "Slug" }, required: true },
  { key: "title_en", label: { en: "Title" } },
  { key: "body_en", label: { en: "Body" }, type: "textarea", rows: 6, hideInTable: true },
  { key: "published", label: { en: "Published" }, type: "boolean" },
];

export const prefetch = prefetchCrud("Page");

export default function AdminPages() {
  return (
    <AdminCrudTable
      entity="Page"
      title={{ en: "Pages (CMS)" }}
      subtitle={{ en: "Edit legal and content pages (Terms, Privacy, About, FAQ)." }}
      addLabel={{ en: "New page" }}
      emptyLabel={{ en: "No pages yet." }}
      fields={fields}
    />
  );
}