import { useEffect, useMemo } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { configKeys } from "./keys";

/**
 * Site configuration: settings, editable copy, categories, payment methods,
 * the published theme. It changes only when staff edit it, so it never goes
 * stale on a timer (`staleTime: Infinity`). Realtime pushes edits into the
 * cache, and a dropped channel re-reads on reconnect.
 */
const CONFIG = { staleTime: Infinity, gcTime: Infinity, refetchOnWindowFocus: false };
// Tables without a realtime subscription here: re-read at most every 10 min.
const SLOW_CONFIG = { staleTime: 10 * 60_000, gcTime: Infinity, refetchOnWindowFocus: false };

/** Upsert one realtime row into a cached list. */
export function mergeRow(list, ev) {
  const row = ev?.data || {};
  if (!Array.isArray(list) || !row.id) return list;
  const rest = list.filter((x) => x.id !== row.id);
  if (ev.type === "delete") return rest;
  const existing = list.find((x) => x.id === row.id);
  return existing ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...rest, row];
}

export const configQueries = {
  settings: () =>
    queryOptions({
      queryKey: configKeys.settings(),
      queryFn: () => base44.entities.SiteSettings.list(),
      ...CONFIG,
    }),
  content: () =>
    queryOptions({
      queryKey: configKeys.content(),
      queryFn: () => base44.entities.Content.list(50),
      ...CONFIG,
    }),
  // CMS pages (admin → Pages). `pages` is not in the realtime publication,
  // so edits reach open tabs on the 10-minute re-read (or a reload).
  // Readers pick the published row by slug (usePublishedPage).
  pages: () =>
    queryOptions({
      queryKey: configKeys.pages(),
      queryFn: () => base44.entities.Page.list("-updated_date", 100),
      ...SLOW_CONFIG,
    }),
  categories: () =>
    queryOptions({
      queryKey: configKeys.categories(),
      queryFn: () => base44.entities.Category.list("sort_order", 100),
      ...SLOW_CONFIG,
    }),
  brands: () =>
    queryOptions({
      queryKey: configKeys.brands(),
      queryFn: () => base44.entities.Brand.list("sort_order", 200),
      ...SLOW_CONFIG,
    }),
  paymentMethods: () =>
    queryOptions({
      queryKey: configKeys.paymentMethods(),
      queryFn: () => base44.entities.PaymentMethod.filter({ enabled: true }, "display_order", 50),
      ...SLOW_CONFIG,
    }),
  publishedTheme: () =>
    queryOptions({
      queryKey: configKeys.publishedTheme(),
      queryFn: async () => {
        const rows = await base44.entities.Theme.filter({ scope: "published" }, "-created_date", 1).catch(() => []);
        return rows?.[0] || null;
      },
      ...CONFIG,
    }),
};

/** Keep a cached config list in step with its table. */
function useConfigRealtime(entity, queryKey) {
  const qc = useQueryClient();
  const keyStr = JSON.stringify(queryKey);
  useEffect(() => {
    const key = JSON.parse(keyStr);
    return entity.subscribe((ev) => qc.setQueryData(key, (prev) => mergeRow(prev, ev)), {
      onReconnect: () => qc.invalidateQueries({ queryKey: key }),
    });
  }, [entity, keyStr, qc]);
}

/** The global site_settings row (key "global", or the first row). */
export const pickGlobalSettings = (rows) => rows?.find((r) => r?.key === "global" || !r?.key) || rows?.[0] || null;

export function useSiteSettings() {
  const query = useQuery(configQueries.settings());
  useConfigRealtime(base44.entities.SiteSettings, configKeys.settings());
  return query;
}

export function useContentQuery() {
  const query = useQuery(configQueries.content());
  useConfigRealtime(base44.entities.Content, configKeys.content());
  return query;
}

/**
 * The published CMS page for a slug ("terms", "privacy", "about", "faq"), or
 * null when there is none. `isPending` is true until the first read returns.
 */
export function usePublishedPage(slug) {
  const { pages, isPending, isError } = usePublishedPages();
  const want = String(slug || "").trim().toLowerCase();
  return { page: pages.get(want) || null, isPending, isError };
}

const NO_PAGES = new Map();

/**
 * Published CMS pages by slug (newest edit wins when a slug is repeated).
 * A page counts only when it is published and has a body.
 */
export function usePublishedPages() {
  const query = useQuery(configQueries.pages());
  const pages = useMemo(() => {
    if (!query.data?.length) return NO_PAGES;
    const map = new Map();
    // The query is sorted newest first, so the first row per slug wins.
    query.data.forEach((p) => {
      const slug = String(p?.slug || "").trim().toLowerCase();
      if (p?.published && slug && (p.body_en || "").trim() && !map.has(slug)) map.set(slug, p);
    });
    return map;
  }, [query.data]);
  return { pages, isPending: query.isPending, isError: query.isError };
}

export function useCategories() {
  return useQuery(configQueries.categories());
}

export function useBrands() {
  return useQuery(configQueries.brands());
}

const NO_ROWS = [];
const activeOnly = (rows) => (rows || NO_ROWS).filter((r) => r.active !== false);

/**
 * Active categories and brands plus id → row lookups, for labelling auctions
 * and building filters. An auction whose category or brand was deleted or
 * switched off simply shows no label.
 */
export function useAuctionTaxonomy() {
  const { data: categoryRows } = useCategories();
  const { data: brandRows } = useBrands();
  return useMemo(() => {
    const categories = activeOnly(categoryRows);
    const brands = activeOnly(brandRows);
    return {
      categories,
      brands,
      categoryById: new Map(categories.map((c) => [c.id, c])),
      brandById: new Map(brands.map((b) => [b.id, b])),
    };
  }, [categoryRows, brandRows]);
}

export function usePaymentMethods() {
  return useQuery(configQueries.paymentMethods());
}

/** Drop every config query so the next read goes to the database (after admin edits). */
export function invalidateConfig(qc) {
  return qc.invalidateQueries({ queryKey: configKeys.all });
}
