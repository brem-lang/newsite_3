import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { adminKeys } from "./keys";

/**
 * Staff-area data. Everything here runs on the separate staff session
 * (base44 picks it on /admin paths) and lives under its own key roots
 * (["admin", …], ["admin-entity", …]) so it never mixes with customer data.
 *
 * Admin tables are fresh for 30s by default; "live" dashboards add a slow
 * refetchInterval (≥20s, paused in background tabs) plus throttled realtime
 * invalidation (see useInvalidateOn in ./live.js).
 */
export const ADMIN_STALE = 30_000;

export const adminQueries = {
  /** The staff member's capabilities, or null when not signed in as staff. */
  capabilities: () =>
    queryOptions({
      queryKey: adminKeys.capabilities(),
      queryFn: async () => {
        if (!(await base44.adminAuth.isAuthenticated())) return null;
        const res = await base44.functions.invoke("myAdminCapabilities", {});
        const data = res?.data && !res.data.error ? res.data : null;
        return data?.is_admin ? data : null;
      },
      staleTime: 5 * 60_000,
      retry: false,
    }),
};

export function useAdminCapabilities() {
  return useQuery(adminQueries.capabilities());
}

/**
 * A panel's data under a key from `adminKeys` (./keys.js). `queryFn` loads
 * everything the panel shows; the panel reads `data` and calls `refresh()`
 * after writes instead of re-running its own loader.
 *
 *   const { data, isPending, refresh } = useAdminData(adminKeys.coupons(), loadCoupons);
 */
export function useAdminData(key, queryFn, options = {}) {
  const qc = useQueryClient();
  const keyStr = JSON.stringify(key);
  const queryKey = useMemo(() => JSON.parse(keyStr), [keyStr]);
  const query = useQuery({ queryKey, queryFn, staleTime: ADMIN_STALE, ...options });
  // Stable identity, so callers can list it in effect deps safely.
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, queryKey]);
  return { ...query, refresh, queryKey };
}

/**
 * The query options useAdminData builds, for use outside a component (a
 * panel's `prefetch`). Pass the same parts, queryFn and options as the hook so
 * both hit the same cache entry.
 */
export const adminSection = (queryKey, queryFn, options = {}) =>
  queryOptions({ queryKey, queryFn, staleTime: ADMIN_STALE, ...options });

/**
 * Warm the cache before a panel renders. Each admin panel exports
 * `prefetch(queryClient)`, and the /admin route loaders await it, so switching
 * sections keeps the current panel on screen under the top progress bar until
 * the next one has its data.
 *
 * fetchQuery, not ensureQueryData: data still inside its staleTime is used as
 * is (no request), but stale data is re-fetched and awaited here. Otherwise a
 * revisit paints the old cached rows and swaps them for fresh ones a moment
 * later. Falsy options and `enabled: false` ones are skipped. A failed read
 * doesn't block navigation; the panel shows its own error state.
 * Resolves to each option's data (undefined when skipped or failed).
 */
export const warmAdmin = (qc, ...options) =>
  Promise.all(
    options.map((o) =>
      o && o.enabled !== false ? qc.fetchQuery(o).catch(() => undefined) : undefined,
    ),
  );

/** Forget all staff data (after a staff sign-out). */
export function clearAdminCache(qc) {
  qc.setQueryData(adminKeys.capabilities(), null);
  qc.removeQueries({ queryKey: adminKeys.entities });
  qc.removeQueries({ predicate: (q) => q.queryKey[0] === "admin" && q.queryKey[1] !== "capabilities" });
}

/* ------------------------- shared lookup tables ------------------------- */
// Many panels need "user by id" / "auction by id" to label rows. They share
// one cached read each instead of every panel downloading its own copy.

const toMap = (rows) => {
  const m = {};
  (rows || []).forEach((r) => { if (r?.id) m[r.id] = r; });
  return m;
};
const NONE = [];

const usersQuery = () =>
  queryOptions({
    queryKey: adminKeys.usersLookup(),
    queryFn: async () => (await base44.entities.User.list("", 2000).catch(() => [])) || [],
    staleTime: 60_000,
  });

const auctionsLookupQuery = () =>
  queryOptions({
    queryKey: adminKeys.auctionsLookup(),
    queryFn: async () => (await base44.entities.Auction.list("-created_date", 500).catch(() => [])) || [],
    staleTime: 30_000,
  });

/** Every user row (role attached), shared by the admin panels. */
export function useAdminUsers() {
  const { data = NONE, ...rest } = useQuery(usersQuery());
  return { data, ...rest };
}

/** { [userId]: user } */
export function useAdminUserMap() {
  const { data = EMPTY_MAP } = useQuery({ ...usersQuery(), select: toMap });
  return data;
}

/** The latest 500 auctions, shared by the admin panels. */
export function useAdminAuctions() {
  const { data = NONE, ...rest } = useQuery(auctionsLookupQuery());
  return { data, ...rest };
}

/** { [auctionId]: auction } */
export function useAdminAuctionMap() {
  const { data = EMPTY_MAP } = useQuery({ ...auctionsLookupQuery(), select: toMap });
  return data;
}
const EMPTY_MAP = {};
const EMPTY_LIST = [];

export { toMap };

/** Every bid of one auction (up to 500), shared by the results table and its bid log. */
export const auctionBidsQuery = (auctionId) =>
  queryOptions({
    queryKey: adminKeys.auctionBids(auctionId),
    queryFn: async () => (await base44.entities.Bid.filter({ auction_id: auctionId }, "-created_date", 500).catch(() => [])) || [],
    enabled: !!auctionId,
    staleTime: ADMIN_STALE,
  });

/** One auction's audit trail (lifecycle actions and staff edits), newest first. */
export const auctionHistoryQuery = (auctionId) =>
  queryOptions({
    queryKey: adminKeys.auctionHistory(auctionId),
    queryFn: async () => (await base44.entities.ActivityLog.filter({ target_id: auctionId }, "-created_date", 50).catch(() => [])) || [],
    enabled: !!auctionId,
    staleTime: ADMIN_STALE,
  });

/** Newest system events (auction ended / started / cancelled, nothing left live). */
export const systemEventsQuery = () =>
  queryOptions({
    queryKey: adminKeys.systemEvents(),
    queryFn: async () => (await base44.entities.ActivityLog.filter({ source: "system" }, "-created_date", 30).catch(() => [])) || [],
    staleTime: ADMIN_STALE,
  });

/** The signed-in staff profile, shared by every panel that needs it. */
const meQuery = () =>
  queryOptions({
    queryKey: adminKeys.me(),
    queryFn: () => base44.adminAuth.me().catch(() => null),
    staleTime: 5 * 60_000,
  });

export function useAdminMe() {
  const { data = null } = useQuery(meQuery());
  return data;
}

/** Shared lookup queries, for the panels' prefetch functions. */
export const adminLookups = { users: usersQuery, auctions: auctionsLookupQuery, me: meQuery };

/** Prefix for every listUsers page: invalidate this to refresh Users and Participants. */
export const ADMIN_USER_LIST_KEY = adminKeys.usersList();

export const DEFAULT_USER_LIST = { page: 1, pageSize: 25, search: "", status: "all", role: "all" };

/**
 * One server-side page of listUsers (users + their participant notes), shared by
 * Users and Participants. Search, filters and paging all run in Postgres.
 *   -> { users, notes, total, page, pageSize, pageCount }
 */
export const adminUserListQuery = (params = DEFAULT_USER_LIST) => {
  const p = { ...DEFAULT_USER_LIST, ...params };
  return queryOptions({
    queryKey: adminKeys.usersListPage(p),
    queryFn: async () => {
      const res = await base44.functions.invoke("listUsers", p);
      if (res.data?.error) throw new Error(res.data.error);
      const d = res.data || {};
      return {
        users: d.users || [],
        notes: d.notes || [],
        total: Number(d.total || 0),
        pageCount: Number(d.pageCount || 1),
      };
    },
    staleTime: ADMIN_STALE,
    placeholderData: keepPreviousData,
  });
};

/** Every user id matching the filters (for "select all matching"), not just one page. */
export const fetchAdminUserIds = async ({ search = "", status = "all", role = "all" } = {}) => {
  const res = await base44.functions.invoke("listUsers", { search, status, role, idsOnly: true });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.ids || [];
};

/* ------------------------- server-paged admin tables ------------------------- */

/**
 * Query options for one page of `entity`, filtered/sorted/counted in Postgres
 * through `entity.page(params)`. Use in prefetch with the same params the
 * component starts with so both hit one cache entry.
 */
export const adminPageQuery = (entity, queryKey, params, options = {}) =>
  queryOptions({
    queryKey,
    queryFn: () => base44.entities[entity].page(params),
    staleTime: ADMIN_STALE,
    placeholderData: keepPreviousData,
    ...options,
  });

/**
 * Page state + one server page of `entity`.
 *   const t = useAdminPage("Notification", adminKeys.notificationsPage, { where, sort: "-created_date" });
 *   t.rows, t.total, t.isPending, t.isPlaceholderData, t.refresh()
 *   <AdminPagination {...t.pagination} />
 * `keyFor(params)` builds the cache key from adminKeys. The page resets to 1
 * when the filters or page size change, and steps back when a delete empties it.
 */
export function useAdminPage(entity, keyFor, filters = {}, { initialPageSize = 25, ...options } = {}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const filterSig = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filterSig, pageSize]);

  const params = useMemo(() => ({ ...JSON.parse(filterSig), page, pageSize }), [filterSig, page, pageSize]);
  const query = useQuery(adminPageQuery(entity, keyFor(params), params, options));
  const pageCount = query.data?.pageCount || 1;
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [query.data, query.isPlaceholderData, page, pageCount]);

  const queryKey = keyFor(params);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, JSON.stringify(queryKey)]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = query.data?.total ?? 0;
  return {
    ...query,
    rows: query.data?.rows ?? NONE,
    total,
    pageCount,
    page,
    pageSize,
    params,
    queryKey,
    setPage,
    setPageSize,
    refresh,
    pagination: { page: Math.min(page, pageCount), pageSize, total, onPage: setPage, onPageSize: setPageSize },
  };
}

/** First-page params a useAdminPage table starts with (for prefetch). */
export const firstPage = (filters = {}, pageSize = 25) => ({ ...filters, page: 1, pageSize });

/* ----------------- name lookups for just the rows on screen ----------------- */
// Paged tables label rows by looking up only the ids on the current page, so
// no lookup table has to hold every user or auction.

const uniqIds = (ids) => [...new Set((ids || []).filter(Boolean).map(String))].sort();

const USER_LABEL_FIELDS = "id, full_name, email";

/** fields defaults to the name columns; pass "*" when the rows are used for more (e.g. contacting a winner). */
export const usersByIdsQuery = (ids, fields = USER_LABEL_FIELDS) => {
  const list = uniqIds(ids);
  return queryOptions({
    queryKey: adminKeys.usersByIds(list, fields),
    queryFn: async () => toMap(await base44.entities.User.filterFields(fields, { id: list }, "", list.length)),
    enabled: list.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Lookup maps returned by the *ByIds hooks carry this (non-enumerable) flag
 * while ids new to the screen are still loading, so a cell can show a
 * placeholder instead of a raw id that turns into a name a moment later.
 */
const LABELS_LOADING = Symbol("labelsLoading");

/** The query's map, flagged as loading while it fetches a key it has no data for yet. */
export function useLabelMap(query) {
  const map = query.data ?? EMPTY_MAP;
  const loading = query.fetchStatus === "fetching" && (query.isPending || query.isPlaceholderData);
  return useMemo(
    () => (loading ? Object.defineProperty({ ...map }, LABELS_LOADING, { value: true }) : map),
    [map, loading],
  );
}

/** True while `id` isn't in `map` yet but its lookup is still loading. */
export const isLabelLoading = (map, id) => !!id && !map?.[id] && !!map?.[LABELS_LOADING];

/** True while a lookup returned by one of these hooks is loading a key it has no data for. */
export const isLookupLoading = (lookup) => !!lookup?.[LABELS_LOADING];

/** { [userId]: { id, full_name, email } } for the given ids (or the given fields). */
export function useAdminUsersByIds(ids, fields) {
  return useLabelMap(useQuery(usersByIdsQuery(ids, fields)));
}

const AUCTION_LABEL_FIELDS = "id, title, paid, status";

export const auctionsByIdsQuery = (ids) => {
  const list = uniqIds(ids);
  return queryOptions({
    queryKey: adminKeys.auctionsByIds(list),
    queryFn: async () => toMap(await base44.entities.Auction.filterFields(AUCTION_LABEL_FIELDS, { id: list }, "", list.length)),
    enabled: list.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
};

/** { [auctionId]: { id, title, paid, status } } for the given ids. */
export function useAdminAuctionsByIds(ids) {
  return useLabelMap(useQuery(auctionsByIdsQuery(ids)));
}

/**
 * For a panel's prefetch: load the name lookups for the rows it paints first,
 * so names are there on first render instead of popping in after the rows.
 *   await warmLabels(qc, page?.rows, { users: ["user_id"], auctions: ["auction_id"] });
 * Pass the same rows, id fields and userFields the component gives the *ByIds
 * hooks, so both land on one cache entry. `extra`: more query options to warm.
 */
export const warmLabels = (
  qc,
  rows,
  { users = [], userFields, auctions = [], extra = [] } = {},
) => {
  const list = rows || NONE;
  const pick = (fields) => list.flatMap((r) => fields.map((f) => r?.[f]));
  return warmAdmin(
    qc,
    users.length ? usersByIdsQuery(pick(users), userFields) : null,
    auctions.length ? auctionsByIdsQuery(pick(auctions)) : null,
    ...extra,
  );
};

/** Calls a Postgres function on the staff session and throws on error. */
export const adminRpc = (name, args = {}) => base44.rpc(name, args);

/** Users per verification status (non-admin members by default), counted on the server. */
export const adminUserStatusCountsQuery = (params = { role: "user" }) =>
  queryOptions({
    queryKey: adminKeys.usersStatusCounts(params),
    queryFn: async () => {
      const res = await base44.functions.invoke("listUsers", { ...params, counts: true });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.counts || { pending: 0, verified: 0, rejected: 0 };
    },
    staleTime: ADMIN_STALE,
  });

/**
 * Page state + one server page of listUsers, for tables beyond Users/Participants.
 *   const q = useAdminUserPage({ status: ["verified", "rejected"], role: "user" });
 */
export function useAdminUserPage(filters = {}, { initialPageSize = 25 } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const filterSig = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [filterSig, pageSize]);
  const query = useQuery(adminUserListQuery({ ...JSON.parse(filterSig), page, pageSize }));
  const total = query.data?.total ?? 0;
  const pageCount = query.data?.pageCount ?? 1;
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [query.data, query.isPlaceholderData, page, pageCount]);
  return {
    ...query,
    rows: query.data?.users ?? NONE,
    total,
    pagination: { page: Math.min(page, pageCount), pageSize, total, onPage: setPage, onPageSize: setPageSize },
  };
}

/* ------------------------------ auctions screen ------------------------------ */

/**
 * One page of ended / archived auctions from admin_ended_auctions: filtered,
 * paged and totalled in Postgres, each row carrying its `bid_count`.
 *   params: { statuses, search, from, to, payment: "all"|"paid"|"unpaid", page, pageSize }
 *   -> { rows, total, totals: { seats, entry, bidRev, total, maxTotal }, page, pageSize, pageCount }
 */
export const fetchEndedAuctions = async ({ statuses, search = "", from = "", to = "", payment = "all", page = 1, pageSize = 10 }) => {
  // Same day bounds as before: `from` at the start of its day, `to` at its last millisecond.
  const res = await adminRpc("admin_ended_auctions", {
    _statuses: statuses,
    _search: search,
    _from: from ? new Date(from).toISOString() : null,
    _to: to ? new Date(new Date(to).getTime() + 86399999).toISOString() : null,
    _paid: payment === "all" ? null : payment === "paid",
    _page: page,
    _page_size: pageSize,
  });
  return { rows: [], total: 0, totals: {}, pageCount: 1, ...(res || {}) };
};

export const endedAuctionsQuery = (params) =>
  queryOptions({
    queryKey: adminKeys.auctionsEnded(params),
    queryFn: () => fetchEndedAuctions(params),
    staleTime: ADMIN_STALE,
    placeholderData: keepPreviousData,
  });

/** Tab counts and the all-time entry-fee revenue (admin_auction_counts). */
export const auctionCountsQuery = () =>
  queryOptions({
    queryKey: adminKeys.auctionsCounts(),
    queryFn: async () => ({ ended: 0, archived: 0, nonArchived: 0, revenue: 0, ...((await adminRpc("admin_auction_counts")) || {}) }),
    staleTime: ADMIN_STALE,
  });

/**
 * Every row matching `opts`, read through page() in batches of 1000 so no
 * silent row cap applies. For reports over a naturally bounded table
 * (auctions, their cost lines) — not for ledgers; sum those in SQL instead.
 */
export async function fetchAllRows(entity, opts = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await base44.entities[entity].page({ ...opts, page, pageSize: 1000 });
    out.push(...res.rows);
    if (page >= res.pageCount) return out;
  }
}

/**
 * Winner payment records (winner_payments) for the given auctions, read on
 * the staff session. These, not auctions.paid, decide whether a win is paid.
 */
export const winnerPaymentsByAuctionsQuery = (auctionIds) => {
  const ids = uniqIds(auctionIds);
  return queryOptions({
    queryKey: adminKeys.winnerPaymentsByAuctions(ids),
    queryFn: async () => (await base44.entities.WinnerPayment.filter({ auction_id: ids }, "-created_date", 500)) || [],
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
};

/** The records as a list; isLookupLoading(list) is true while a new page's records load. */
export function useAdminWinnerPaymentsByAuctions(auctionIds) {
  const query = useQuery(winnerPaymentsByAuctionsQuery(auctionIds));
  const list = query.data ?? EMPTY_LIST;
  const loading = query.fetchStatus === "fetching" && query.isPending;
  return useMemo(
    () => (loading ? Object.defineProperty([...list], LABELS_LOADING, { value: true }) : list),
    [list, loading],
  );
}

/** The winner's payment record for an auction (a paid one first), or null. */
export const winnerPaymentFor = (payments, auctionId, winnerId) =>
  payments.find((p) => p.auction_id === auctionId && p.user_id === winnerId && p.status === "paid") ||
  payments.find((p) => p.auction_id === auctionId && p.user_id === winnerId) ||
  null;
