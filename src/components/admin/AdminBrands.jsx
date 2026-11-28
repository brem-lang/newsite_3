import React from "react";
import AdminCrudTable, { prefetchCrud } from "./AdminCrudTable";
import { configKeys } from "@/lib/queries/keys";

const fields = [
  { key: "name", label: { en: "Name" }, required: true },
  { key: "slug", label: { en: "Slug" } },
  { key: "logo_url", label: { en: "Logo URL" }, type: "url", hideInTable: true },
  { key: "sort_order", label: { en: "Sort order" }, type: "number" },
  { key: "active", label: { en: "Active" }, type: "boolean" },
];

export const prefetch = prefetchCrud("Brand");

export default function AdminBrands() {
  return (
    <AdminCrudTable
      entity="Brand"
      title={{ en: "Brands" }}
      subtitle={{ en: "Organize auctions by brand." }}
      addLabel={{ en: "Add brand" }}
      emptyLabel={{ en: "No brands yet." }}
      fields={fields}
      configKey={configKeys.brands()}
    />
  );
}