# Patterns

Templates for `src/lib/queries/`. Adapt names; keep the shape.

## Contents
1. Key factories
2. Query options + hook
3. Live data: realtime + safety poll
4. Mutations
5. Before / after: useEffect + setInterval
6. Route loader prefetch

---

## 1. Key factories — `src/lib/queries/keys.js`

```js
// Hierarchical keys: invalidate ["auctions"] to hit every auction query,
// or a specific detail key to hit one.
export const auctionKeys = {
  all: ["auctions"],
  lists: () => [...auctionKeys.all, "list"],
  list: (filters, viewer) => [...auctionKeys.lists(), filters, viewer ?? "anon"],
  detail: (id) => [...auctionKeys.all, "detail", id],
};

export const bidKeys = {
  byAuction: (auctionId) => ["bids", auctionId],
};
```

When migrating existing code, a factory may return the legacy key (e.g. `["auction", id]`) so current invalidations keep working; switch to the new shape in one pass later.

## 2. Query options + hook — `src/lib/queries/auctions.js`

```js
import { queryOptions, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { auctionKeys } from "./keys";

const LIST_FIELDS = "id, title, current_price, round, status, end_time, image_url";

export const auctionQueries = {
  list: (filters = {}, viewer) =>
    queryOptions({
      queryKey: auctionKeys.list(filters, viewer),
      queryFn: () => base44.entities.Auction.filterFields(LIST_FIELDS, filters, "-created_date", 50),
      staleTime: 30_000,
    }),
  detail: (id) =>
    queryOptions({
      queryKey: auctionKeys.detail(id),
      queryFn: () => base44.entities.Auction.get(id),
      enabled: !!id,
      staleTime: 10_000,
    }),
};

export function useAuctionList(filters, viewer) {
  return useQuery(auctionQueries.list(filters, viewer));
}
```

Fetch only the columns the screen shows (`filterFields` / `listFields`) for lists.

## 3. Live data: realtime + safety poll

```js
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useLiveAuction(id) {
  const qc = useQueryClient();
  const query = useQuery({
    ...auctionQueries.detail(id),
    refetchInterval: 30_000,            // safety net only
    refetchIntervalInBackground: false, // stop in hidden tabs
  });

  useEffect(() => {
    if (!id) return;
    const key = auctionKeys.detail(id);
    return base44.entities.Auction.subscribe(
      (ev) => {
        if (ev.type === "delete") return qc.removeQueries({ queryKey: key });
        // Full row in the payload: merge it, no network request.
        qc.setQueryData(key, (prev) => (prev ? { ...prev, ...ev.data } : prev));
      },
      {
        filter: `id=eq.${id}`,
        onReconnect: () => qc.invalidateQueries({ queryKey: key }),
      },
    );
  }, [id, qc]);

  return query;
}
```

For aggregates (balance, counts) invalidate instead of merging:

```js
const refresh = () => qc.invalidateQueries({ queryKey: ["wallet", userId] }, { cancelRefetch: false });
```

## 4. Mutations

```js
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function usePlaceBid(auctionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount) => base44.functions.invoke("placeBid", { auction_id: auctionId, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bidKeys.byAuction(auctionId) });
      qc.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
    },
  });
}
```

In the component: `const placeBid = usePlaceBid(id); placeBid.mutate(amount)`; use `placeBid.isPending` instead of a separate `loading` state.

Optimistic version: in `onMutate` cancel queries, snapshot with `getQueryData`, write with `setQueryData`, return the snapshot; restore it in `onError`; invalidate in `onSettled`.

## 5. Before / after

Before — typical pattern in this repo:

```jsx
const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(true);
const load = useCallback(async () => {
  const data = await base44.entities.WalletTransaction.filter({ user_id: user.id }, "-created_date", 200);
  setRows(data);
  setLoading(false);
}, [user.id]);
useEffect(() => {
  load();
  const unsub = base44.entities.WalletTransaction.subscribe(load); // unfiltered, refetches on any user's change
  const poll = setInterval(load, 20000);                            // runs in hidden tabs, per component
  return () => { unsub(); clearInterval(poll); };
}, [load]);
```

After:

```jsx
const { transactions, loading } = useWallet(user?.id, true);
```

…where the hook owns the query, the filtered subscription and the 60 s background-paused poll.

## 6. Route loader prefetch (TanStack Router)

The router context already carries `queryClient`, so a route can warm the cache before render:

```ts
loader: ({ context: { queryClient }, params }) =>
  queryClient.ensureQueryData(auctionQueries.detail(params.id)),
```

The component then calls `useQuery(auctionQueries.detail(id))` and renders without a loading flash. Search params, `loaderDeps`, guards, typed links and not-found handling are covered in `router.md`.
