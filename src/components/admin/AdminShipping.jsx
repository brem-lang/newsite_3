import React from "react";
import AdminCrudTable from "./AdminCrudTable";

const fields = [
  { key: "name", label: { en: "Name" }, required: true },
  { key: "carrier", label: { en: "Carrier" } },
  { key: "zone", label: { en: "Zone" } },
  { key: "rate_flat", label: { en: "Flat rate" }, type: "number" },
  { key: "rate_per_kg", label: { en: "Rate / kg" }, type: "number" },
  { key: "estimated_days", label: { en: "Days" }, type: "number" },
  { key: "active", label: { en: "Active" }, type: "boolean" },
];

export default function AdminShipping() {
  return (
    <AdminCrudTable
      entity="ShippingMethod"
      title={{ en: "Shipping methods" }}
      subtitle={{ en: "Carriers, zones, and rates." }}
      addLabel={{ en: "Add method" }}
      emptyLabel={{ en: "No shipping methods yet." }}
      fields={fields}
    />
  );
}