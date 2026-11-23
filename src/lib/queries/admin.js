import { useCallback, useMemo } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
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
 * A section's data under ["admin", section, ...parts]. `queryFn` loads
 * everything the panel shows; the panel reads `data` and calls `refresh()`
 * after writes instead of re-running its own loader.
 *
 *   const { data, isPending, refresh } = useAdminData(["refunds"], loadRefunds);
 */
export function useAdminData(parts, queryFn, options = {}) {
  const qc = useQueryClient();
  const keyStr = JSON.stringify(parts);
  const queryKey = useMemo(() => adminKeys.section(...JSON.parse(keyStr)), [keyStr]);
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
export const adminSection = (parts, queryFn, options = {}) =>
  queryOptions({ queryKey: adminKeys.section(...parts), queryFn, staleTime: ADMIN_STALE, ...options });

/**
 * Warm the cache before a panel renders. Each admin panel exports
 * `prefetch(queryClient)`, and the /admin route loaders await it, so switching
 * sections keeps the current panel on screen under the top progress bar until
 * the next one has its data. Cached data is used as is (the panel revalidates
 * it in the background when stale). A failed read doesn't block navigation;
 * the panel shows its own error state.
 */
export const warmAdmin = (qc, ...options) =>
  Promise.all(options.map((o) => qc.ensureQueryData(o).catch(() => undefined)));

/** Forget all staff data (after a staff sign-out). */
export function clearAdminCache(qc) {
  qc.setQueryData(adminKeys.capabilities(), null);
  qc.removeQueries({ queryKey: ["admin-entity"] });
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
    queryKey: adminKeys.section("users", "lookup"),
    queryFn: async () => (await base44.entities.User.list("", 2000).catch(() => [])) || [],
    staleTime: 60_000,
  });

const auctionsLookupQuery = () =>
  queryOptions({
    queryKey: adminKeys.section("auctions", "lookup"),
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

export { toMap };

/** Every bid of one auction (up to 500), shared by the results table and its bid log. */
export const auctionBidsQuery = (auctionId) =>
  queryOptions({
    queryKey: adminKeys.section("auctionBids", auctionId),
    queryFn: async () => (await base44.entities.Bid.filter({ auction_id: auctionId }, "-created_date", 500).catch(() => [])) || [],
    enabled: !!auctionId,
    staleTime: ADMIN_STALE,
  });

/** One auction's audit trail (lifecycle actions and staff edits), newest first. */
export const auctionHistoryQuery = (auctionId) =>
  queryOptions({
    queryKey: adminKeys.section("auctionHistory", auctionId),
    queryFn: async () => (await base44.entities.ActivityLog.filter({ target_id: auctionId }, "-created_date", 50).catch(() => [])) || [],
    enabled: !!auctionId,
    staleTime: ADMIN_STALE,
  });

/** Newest system events (auction ended / started / cancelled, nothing left live). */
export const systemEventsQuery = () =>
  queryOptions({
    queryKey: adminKeys.section("systemEvents"),
    queryFn: async () => (await base44.entities.ActivityLog.filter({ source: "system" }, "-created_date", 30).catch(() => [])) || [],
    staleTime: ADMIN_STALE,
  });

/** The signed-in staff profile, shared by every panel that needs it. */
const meQuery = () =>
  queryOptions({
    queryKey: adminKeys.section("me"),
    queryFn: () => base44.adminAuth.me().catch(() => null),
    staleTime: 5 * 60_000,
  });

export function useAdminMe() {
  const { data = null } = useQuery(meQuery());
  return data;
}

/** Shared lookup queries, for the panels' prefetch functions. */
export const adminLookups = { users: usersQuery, auctions: auctionsLookupQuery, me: meQuery };

/** listUsers (users + participant notes), shared by Users and Participants. */
export const adminUserListQuery = () =>
  queryOptions({
    queryKey: adminKeys.section("users", "list"),
    queryFn: async () => {
      const res = await base44.functions.invoke("listUsers");
      return { users: res.data?.users || [], notes: res.data?.notes || [] };
    },
    staleTime: ADMIN_STALE,
  });
