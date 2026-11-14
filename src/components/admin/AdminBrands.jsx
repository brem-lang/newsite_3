import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "name", label: { en: "Name", ar: "الاسم" }, required: true },
  { key: "slug", label: { en: "Slug", ar: "المعرّف" } },
  { key: "logo_url", label: { en: "Logo URL", ar: "رابط الشعار" }, type: "url", hideInTable: true },
  { key: "sort_order", label: { en: "Sort order", ar: "ترتيب الفرز" }, type: "number" },
  { key: "active", label: { en: "Active", ar: "مفعّل" }, type: "boolean" },
];

export default function AdminBrands() {
  return (
    <AdminCrudTable
      entity="Brand"
      title={{ en: "Brands", ar: "العلامات التجارية" }}
      subtitle={{ en: "Organize auctions by brand.", ar: "تنظيم المزادات حسب العلامة التجارية." }}
      addLabel={{ en: "Add brand", ar: "إضافة علامة" }}
      emptyLabel={{ en: "No brands yet.", ar: "لا علامات بعد." }}
      fields={fields}
    />
  );
}