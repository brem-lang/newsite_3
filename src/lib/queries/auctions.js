import { useCallback, useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { auctionKeys, bidKeys, chatKeys, fulfilmentKeys, walletKeys } from "./keys";

export const BID_PAGE = 50;
const RECENT_BIDS = 20;
const RECENT_BID_FIELDS = "id,auction_id,user_id,amount,created_date,archived";
const BID_SUMMARY_FIELDS = "auction_id,user_id,amount,archived";
const BID_STATE_THROTTLE_MS = 1500;
const EMPTY_BID_STATE = { burned: [], mine: [] };

/* -------------------------------- queries ------------------------------- */

export const auctionQueries = {
  /**
   * Every auction, newest first. Dashboard, the auctions hub and the public
   * home share this one cached list (per viewer, since signed-out visitors
   * read the public view).
   */
  list: (viewer, limit = 200) =>
    queryOptions({
      queryKey: auctionKeys.list(viewer, limit),
      queryFn: async () => (await base44.entities.Auction.list("-created_date", limit)) || [],
      staleTime: 30_000,
    }),
  detail: (id) =>
    queryOptions({
      queryKey: auctionKeys.detail(id),
      queryFn: () => base44.entities.Auction.get(id),
      enabled: !!id,
      staleTime: 10_000,
      // Live data: catch up when the user returns to the tab (off globally).
      refetchOnWindowFocus: true,
    }),
  bidState: (id) =>
    queryOptions({
      queryKey: auctionKeys.bidState(id),
      // Sealed mode: burned numbers + the caller's own numbers come from the
      // server (other participants' active numbers are never sent).
      queryFn: async () => {
        const res = await base44.functions.invoke("auctionBidState", { auction_id: id });
        if (!res?.data || res.data.error) throw new Error(res?.data?.error || "bid_state_failed");
        return res.data;
      },
      enabled: !!id,
      staleTime: 10_000,
      retry: false,
      refetchOnWindowFocus: true,
    }),
  winnerPayment: (auctionId) =>
    queryOptions({
      queryKey: fulfilmentKeys.payment(auctionId),
      queryFn: async () => {
        const res = await base44.functions.invoke("winnerPayment", { auction_id: auctionId });
        return res?.data?.payment || null;
      },
      enabled: !!auctionId,
      staleTime: 30_000,
    }),
  paymentByToken: (token) =>
    queryOptions({
      queryKey: fulfilmentKeys.byToken(token),
      queryFn: async () => {
        const res = await base44.functions.invoke("winnerPayment", { token });
        if (res.data?.error) throw new Error(res.data.error);
        return { payment: res.data.payment, auction: res.data.auction };
      },
      enabled: !!token,
      staleTime: 30_000,
      retry: false,
    }),
};

export const bidQueries = {
  /** Live round bids for one auction (newest first, capped). */
  byAuction: (auctionId) =>
    queryOptions({
      queryKey: bidKeys.byAuction(auctionId),
      queryFn: () => base44.entities.Bid.filter({ auction_id: auctionId, archived: false }, "-created_date", BID_PAGE),
      enabled: !!auctionId,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    }),
  /** Every bid of a closed auction, for the results screen. */
  allForAuction: (auctionId) =>
    queryOptions({
      queryKey: bidKeys.byAuctionAll(auctionId),
      queryFn: async () => (await base44.entities.Bid.filter({ auction_id: auctionId }, "-created_date", 300)) || [],
      enabled: !!auctionId,
      staleTime: 60_000,
    }),
  /** The signed-in user's own bids (newest first). */
  mine: (userId) =>
    queryOptions({
      queryKey: bidKeys.mine(userId),
      queryFn: async () => (await base44.entities.Bid.filter({ user_id: userId }, "-created_date", 100)) || [],
      enabled: !!userId,
      staleTime: 30_000,
    }),
  /**
   * The newest bids across the given live auctions, for the /home feed.
   * Pass only auctions whose bids are public (never sealed/"closest" ones).
   */
  recent: (viewer, auctionIds = []) =>
    queryOptions({
      queryKey: bidKeys.recent(viewer, auctionIds),
      queryFn: async () =>
        auctionIds.length
          ? ((await base44.entities.Bid.filterFields(RECENT_BID_FIELDS, { auction_id: auctionIds }, "-created_date", RECENT_BIDS).catch(() => [])) || [])
              .filter((b) => !b.archived)
          : [],
      staleTime: 15_000,
    }),
  /** Light bid rows across auctions: counts + "my bid" per auction. */
  summary: (viewer) =>
    queryOptions({
      queryKey: bidKeys.summary(viewer),
      queryFn: async () =>
        (await base44.entities.Bid.listFields(BID_SUMMARY_FIELDS, "-created_date", 1000).catch(() => [])) || [],
      staleTime: 30_000,
    }),
};

/* --------------------------------- hooks -------------------------------- */

export function useAuctionList(viewer, limit) {
  return useQuery(auctionQueries.list(viewer, limit));
}

/**
 * Live bid feed for /home: the cached newest bids plus one realtime stream
 * filtered to the same auctions on the server; new bids are prepended from
 * the event payload (no refetch). A reconnect re-reads the list.
 */
export function useRecentBids(viewer, auctionIds = []) {
  const qc = useQueryClient();
  const options = bidQueries.recent(viewer, auctionIds);
  const query = useQuery(options);
  const idsKey = auctionIds.join(",");
  useEffect(() => {
    if (!idsKey) return undefined;
    const key = bidKeys.recent(viewer, idsKey.split(","));
    return base44.entities.Bid.subscribe(
      (ev) => {
        const row = ev.data || {};
        if (!row.id || ev.type !== "create" || row.archived) return;
        qc.setQueryData(key, (prev = []) => [row, ...prev.filter((b) => b.id !== row.id)].slice(0, RECENT_BIDS));
      },
      { filter: `auction_id=in.(${idsKey})`, onReconnect: () => qc.invalidateQueries({ queryKey: key }) }
    );
  }, [qc, viewer, idsKey]);
  return query;
}

export function useBidSummary(viewer, enabled = true) {
  return useQuery({ ...bidQueries.summary(viewer), enabled });
}

/**
 * Advance every auction's clock on the server (start due rounds, end expired
 * ones) and refresh the cached lists when it's done. Shared by every page that
 * shows lists, so navigating Home -> Auctions -> Home runs it at most once per
 * 30 seconds instead of on every mount.
 */
export function useSyncAuctions(enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: auctionKeys.sync(),
    queryFn: async () => {
      await base44.functions.invoke("syncAuctions").catch(() => {});
      await qc.invalidateQueries({ queryKey: auctionKeys.lists() });
      return Date.now();
    },
    enabled,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Pull-to-refresh for list screens: sync, then re-read lists and bid counts. */
export function useRefreshAuctionLists() {
  const qc = useQueryClient();
  return useCallback(async () => {
    await base44.functions.invoke("syncAuctions").catch(() => {});
    await Promise.all([
      qc.invalidateQueries({ queryKey: auctionKeys.lists() }),
      qc.invalidateQueries({ queryKey: bidKeys.summaryAll() }),
    ]);
  }, [qc]);
}

const timeOrNull = (v) => (v ? new Date(v).getTime() : null);

/**
 * Update the cached auction from a realtime row. Only fields the cached row
 * already has are taken, so the stream never adds columns this visitor's own
 * read didn't include; columns missing from the event keep their cached value.
 */
function mergeKnownFields(prev, row) {
  if (!prev || !row) return prev;
  const next = { ...prev };
  for (const key of Object.keys(row)) if (key in prev) next[key] = row[key];
  return next;
}

/** Apply one realtime bid event to the cached list (newest first, capped). */
function mergeBidEvent(prev = [], ev) {
  const row = ev.data || {};
  if (!row.id) return prev;
  const without = prev.filter((b) => b.id !== row.id);
  if (ev.type === "delete" || row.archived) return without;
  const existing = prev.find((b) => b.id === row.id);
  const next = [existing ? { ...existing, ...row } : row, ...without];
  next.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  return next.slice(0, BID_PAGE);
}

/**
 * One live auction room: the auction row, its current-round bids and the
 * caller's bid state, kept live by filtered realtime streams. A 15s server
 * sync (paused in hidden tabs) promotes/settles the auction clock; the
 * auction is only re-read when the server says its state actually changed.
 */
export function useLiveAuction(id) {
  const qc = useQueryClient();
  const auctionQuery = useQuery(auctionQueries.detail(id));
  const bidsQuery = useQuery(bidQueries.byAuction(id));
  const auction = auctionQuery.data;
  const bidStateQuery = useQuery({
    ...auctionQueries.bidState(id),
    enabled: !!auction?.id,
  });

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: auctionKeys.detail(id) });
    qc.invalidateQueries({ queryKey: bidKeys.byAuction(id) });
  }, [qc, id]);

  const reloadBidState = useCallback(() => {
    qc.invalidateQueries({ queryKey: auctionKeys.bidState(id) }, { cancelRefetch: false });
  }, [qc, id]);

  // Busy auctions produce many bid events per second; refresh the bid state at
  // most once per window instead of once per bid.
  const bidStateTimer = useRef(null);
  const reloadBidStateSoon = useCallback(() => {
    if (bidStateTimer.current) return;
    bidStateTimer.current = setTimeout(() => {
      bidStateTimer.current = null;
      reloadBidState();
    }, BID_STATE_THROTTLE_MS);
  }, [reloadBidState]);
  useEffect(() => () => clearTimeout(bidStateTimer.current), []);

  // The bid state also depends on the mode and round: re-read it when either
  // changes (not on the first render, where the query fetches by itself).
  const phase = auction ? `${auction.mode}|${auction.round}` : null;
  const lastPhase = useRef(null);
  useEffect(() => {
    if (!phase) return;
    if (lastPhase.current !== null && lastPhase.current !== phase) reloadBidState();
    lastPhase.current = phase;
  }, [phase, reloadBidState]);

  const runSync = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("syncAuction", { auction_id: id });
      const server = res?.data;
      const cur = qc.getQueryData(auctionKeys.detail(id));
      if (server && !server.error && cur) {
        const sameEnd = timeOrNull(server.end_time) === timeOrNull(cur.end_time);
        if (server.status !== cur.status || !sameEnd) reload();
      }
    } catch {
      /* the countdown keeps rendering from the last known row */
    }
    return Date.now();
  }, [id, qc, reload]);

  // The auction clock lives in the database. Polling goes through Query so it
  // pauses in background tabs and is shared if the room is mounted twice.
  const syncQuery = useQuery({
    queryKey: auctionKeys.live(id),
    queryFn: runSync,
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (!id) return;
    const resync = () => {
      reload();
      reloadBidState();
    };
    // Only this auction's rows are streamed; each event is applied directly to
    // the cached data instead of triggering a re-fetch.
    const u1 = base44.entities.Auction.subscribe(
      (ev) => {
        if (ev.type === "delete") return;
        qc.setQueryData(auctionKeys.detail(id), (prev) => mergeKnownFields(prev, ev.data));
      },
      { filter: `id=eq.${id}`, onReconnect: resync },
    );
    const u2 = base44.entities.Bid.subscribe(
      (ev) => {
        qc.setQueryData(bidKeys.byAuction(id), (prev) => mergeBidEvent(prev, ev));
        reloadBidStateSoon();
      },
      { filter: `auction_id=eq.${id}`, onReconnect: resync },
    );
    return () => {
      u1();
      u2();
    };
  }, [id, qc, reload, reloadBidState, reloadBidStateSoon]);

  // Pull-to-refresh: an explicit full reload.
  const refreshAll = useCallback(async () => {
    await syncQuery.refetch();
    reload();
    reloadBidState();
  }, [syncQuery, reload, reloadBidState]);

  return {
    auction: auction ?? null,
    bids: bidsQuery.data ?? EMPTY_LIST,
    bidsPending: bidsQuery.isPending,
    bidState: bidStateQuery.data ?? EMPTY_BID_STATE,
    isPending: auctionQuery.isPending,
    error: auctionQuery.error,
    reload,
    reloadBidState,
    refreshAll,
  };
}
const EMPTY_LIST = [];

export const CHAT_LIMIT = 50;
export const CHAT_MAX_LENGTH = 500;

/** Insert or update one message in a cached chat list, keeping the newest CHAT_LIMIT. */
const upsertMessage = (list = [], m) => {
  const i = list.findIndex((x) => x.id === m.id);
  if (i >= 0) return list.map((x, j) => (j === i ? { ...x, ...m } : x));
  return [...list, m].slice(-CHAT_LIMIT);
};

/**
 * The last CHAT_LIMIT chat messages for an auction (oldest first).
 * While the room is open the list streams live. Once it is closed (ended,
 * archived, voided) the history is read once and never re-fetched, and no
 * realtime channel is opened.
 */
export function useAuctionChat(auctionId, { closed = false } = {}) {
  const qc = useQueryClient();
  const key = chatKeys.byAuction(auctionId);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const rows = await base44.entities.AuctionMessage.filter({ auction_id: auctionId }, "-created_date", CHAT_LIMIT);
      return [...(rows || [])].reverse();
    },
    enabled: !!auctionId,
    // A closed room never changes. An open one re-reads on return visits
    // (messages sent while away), and realtime covers the rest.
    staleTime: closed ? Infinity : 30_000,
  });

  useEffect(() => {
    if (!auctionId || closed) return;
    const k = chatKeys.byAuction(auctionId);
    return base44.entities.AuctionMessage.subscribe(
      (ev) => {
        const m = ev.data;
        if (!m?.id) return;
        qc.setQueryData(k, (list = []) =>
          ev.type === "delete" ? list.filter((x) => x.id !== m.id) : upsertMessage(list, m),
        );
      },
      { filter: `auction_id=eq.${auctionId}`, onReconnect: () => qc.invalidateQueries({ queryKey: k }) },
    );
  }, [auctionId, closed, qc]);

  const send = useMutation({
    mutationFn: (values) => {
      if (closed) throw new Error("Chat is closed");
      return base44.entities.AuctionMessage.create({ ...values, auction_id: auctionId });
    },
    // Put the saved row straight into the cache instead of re-fetching all
    // CHAT_LIMIT messages; the realtime echo of the same row is then a no-op.
    onSuccess: (row) => {
      if (row?.id) qc.setQueryData(key, (list = []) => upsertMessage(list, row));
    },
  });

  return { messages: query.data ?? EMPTY_LIST, send, isPending: query.isPending };
}

/* ------------------------------- mutations ------------------------------ */

/**
 * Server actions for the auction room. Each resolves to the raw
 * `{ data, status }` response so the page can turn error codes into the
 * right message; caches are refreshed only when the call succeeded.
 */
export function useAuctionActions(auctionId, userId) {
  const qc = useQueryClient();
  const ok = (res) => !res?.data?.error;
  const refreshRoom = () => {
    qc.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
    qc.invalidateQueries({ queryKey: bidKeys.byAuction(auctionId) });
  };
  const refreshBidState = () => qc.invalidateQueries({ queryKey: auctionKeys.bidState(auctionId) });
  const refreshWallet = () => userId && qc.invalidateQueries({ queryKey: walletKeys.all(userId) });

  const join = useMutation({
    mutationFn: () => base44.functions.invoke("joinAuction", { auction_id: auctionId }),
    onSuccess: (res) => {
      if (!ok(res)) return;
      refreshWallet();
      refreshRoom();
      if (userId) qc.invalidateQueries({ queryKey: auctionKeys.mine(userId) });
      qc.invalidateQueries({ queryKey: auctionKeys.lists() });
    },
  });

  const placeBid = useMutation({
    mutationFn: (body) => base44.functions.invoke("placeBid", { auction_id: auctionId, ...body }),
    onSuccess: (res) => {
      if (!ok(res)) return;
      refreshRoom();
      refreshBidState();
      qc.invalidateQueries({ queryKey: bidKeys.summaryAll() });
    },
  });

  const buyCredits = useMutation({
    mutationFn: (count) => base44.functions.invoke("buyBidCredits", { auction_id: auctionId, count }),
    onSuccess: (res) => {
      if (!ok(res)) return;
      refreshBidState();
      refreshWallet();
    },
  });

  return { join, placeBid, buyCredits };
}

/** The winner's fulfilment (claim) for an auction, kept live. */
export function useFulfilment(auctionId, userId, enabled = true) {
  const qc = useQueryClient();
  const key = fulfilmentKeys.claim(auctionId, userId);
  const on = enabled && !!auctionId && !!userId;
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const rows = await base44.entities.Fulfilment.filter({ auction_id: auctionId, winner_id: userId }, "-created_date", 5);
      return rows?.[0] || null;
    },
    enabled: on,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!on) return;
    const k = fulfilmentKeys.claim(auctionId, userId);
    const refresh = () => qc.invalidateQueries({ queryKey: k }, { cancelRefetch: false });
    return base44.entities.Fulfilment.subscribe(
      (ev) => {
        if (ev.data?.winner_id === userId) refresh();
      },
      { filter: `auction_id=eq.${auctionId}`, onReconnect: refresh },
    );
  }, [on, auctionId, userId, qc]);

  return query;
}

/** The signed-in user's own bids (newest first), for the account history. */
export function useMyBids(userId) {
  return useQuery(bidQueries.mine(userId));
}
