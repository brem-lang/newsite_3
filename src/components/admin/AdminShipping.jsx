import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "name", label: { en: "Name", ar: "الاسم" }, required: true },
  { key: "carrier", label: { en: "Carrier", ar: "شركة الشحن" } },
  { key: "zone", label: { en: "Zone", ar: "المنطقة" } },
  { key: "rate_flat", label: { en: "Flat rate", ar: "سعر ثابت" }, type: "number" },
  { key: "rate_per_kg", label: { en: "Rate / kg", ar: "سعر / كغ" }, type: "number" },
  { key: "estimated_days", label: { en: "Days", ar: "أيام" }, type: "number" },
  { key: "active", label: { en: "Active", ar: "مفعّل" }, type: "boolean" },
];

export default function AdminShipping() {
  return (
    <AdminCrudTable
      entity="ShippingMethod"
      title={{ en: "Shipping methods", ar: "طرق الشحن" }}
      subtitle={{ en: "Carriers, zones, and rates.", ar: "شركات ومناطق وأسعار الشحن." }}
      addLabel={{ en: "Add method", ar: "إضافة طريقة" }}
      emptyLabel={{ en: "No shipping methods yet.", ar: "لا طرق شحن بعد." }}
      fields={fields}
    />
  );
}