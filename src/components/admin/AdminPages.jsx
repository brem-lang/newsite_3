import React from "react";
import AdminCrudTable, { prefetchCrud } from "./AdminCrudTable";
import { SITE_PAGES } from "@/lib/legal";

// Read by src/pages/LegalPage.jsx: the published row whose slug matches the
// route (/terms, /privacy, /about, /faq) replaces the built-in copy.
const fields = [
  {
    key: "slug",
    label: { en: "Page" },
    type: "select",
    required: true,
    // Only slugs the site has a route for, so a page can't be saved where
    // nothing will ever show it.
    options: SITE_PAGES.map((p) => ({ value: p.slug, label: { en: `${p.label} (/${p.slug})` } })),
    hint: {
      en: "Terms and Privacy show built-in text until published. About and FAQ appear in the footer and the mobile Account menu once published.",
    },
  },
  { key: "title_en", label: { en: "Title" } },
  {
    key: "body_en",
    label: { en: "Body" },
    type: "textarea",
    rows: 12,
    hideInTable: true,
    placeholder: "Intro paragraph.\n\n## 1. First heading\n- First point\n- Second point\n\n## 2. Next heading\n- …",
    hint: {
      en: "Text before the first heading is the intro. \"## Heading\" starts a section; each line under it is one bullet.",
    },
  },
  { key: "published", label: { en: "Published" }, type: "boolean" },
];

export const prefetch = prefetchCrud("Page");

export default function AdminPages() {
  return (
    <AdminCrudTable
      entity="Page"
      title={{ en: "Pages (CMS)" }}
      subtitle={{ en: "Edit Terms, Privacy, About and FAQ without a deploy. Only published pages are shown on the site; open tabs pick up changes within 10 minutes." }}
      addLabel={{ en: "New page" }}
      emptyLabel={{ en: "No pages yet. Terms and Privacy are showing the built-in text." }}
      fields={fields}
    />
  );
}
