---
name: data-fetching
description: Refactor or write data fetching, polling, realtime and routing code in this repo with TanStack Query v5 and TanStack Router (Start, SPA mode), using a consistent folder structure. Use this whenever the user asks to fix, clean up, optimize or review how a page or component loads data, polls, refreshes, subscribes to Supabase realtime, or calls base44.entities / base44.functions / base44.rpc, and whenever they add or change a route, loader, auth guard, redirect, link, URL params or search params/filters. That includes requests like "this page makes too many requests", "move this to react query", "why is X being polled everywhere", "add live updates", "add a new page", "prefetch this page", "protect this route", "put the filters in the URL", "migrate off react-router-dom", or any useEffect + useState fetch or setInterval refresh. Never commits.
---

# Data fetching with TanStack Query + TanStack Router

This repo talks to Supabase through `src/api/base44Client.ts` (`base44.entities.<Name>`, `base44.functions.invoke`, `base44.rpc`). Only a handful of files use TanStack Query today; most components still fetch in `useEffect` + `useState` and refresh with `setInterval`. That pattern duplicates requests across components, keeps polling in hidden tabs, and loses data on remount. The goal of this skill is to move code to one predictable structure where the cache is the single source of truth.

`src/lib/useWallet.js` is the reference implementation in the repo: one shared query, one server-filtered realtime channel, a slow safety poll that pauses in the background. Read it before you start if you haven't.

## Ground rules

- **Do not commit, stage, push, or open a PR.** Leave every change in the working tree for the user to review. No `git add`, `git commit`, `git stash`, or branch switching. If the user later asks you to commit, that is a separate, explicit request.
- Change behaviour only where the task needs it. A refactor should show the same data, at the same freshness or better, with fewer requests.
- Keep the existing query keys of code you touch (`["wallet", userId, ...]`, `["auction", id]`, `["bids", id]`, `["myAuctions", userId]`) unless you update every place that invalidates them — grep for the key first.

## Workflow

1. **Map the target.** Read the component/page and list every request it makes: what is fetched, when (mount, interval, focus, realtime event, after a mutation), and which other components fetch the same thing. `grep -rn "base44.entities.<Name>" src` finds duplicates.
2. **Pick the freshness each piece of data needs** (table below). This decides `staleTime`, whether to poll, and whether realtime is worth it.
3. **Write or reuse a query module** in `src/lib/queries/<domain>.js` (structure below). Components import hooks from there; they don't build query keys or call `base44` for reads directly.
4. **Replace the component code**: `useEffect` fetches → `useQuery`; `setInterval` refreshes → `refetchInterval`; writes → `useMutation`; realtime callbacks → `setQueryData` or `invalidateQueries`.
5. **Wire the route** when the page has a route file: add a `loader` that calls `ensureQueryData` with the same query options, move URL state into `validateSearch`, and read params/search through typed route hooks. See the Routing section.
6. **Verify**: run `npm run lint` and `npm run build`. The build also regenerates `routeTree.gen.ts` and type-checks route paths. If the app can be run, open the page and watch the network tab: requests should not repeat faster than the chosen interval, and should stop while the tab is hidden.
7. **Report** what changed, the request count before vs. after where you can tell, and anything you deliberately left alone. Remind the user the changes are uncommitted.

## Folder structure

```
src/lib/queries/
  keys.js          # every query key factory, in one place
  auctions.js      # queryOptions + hooks for one domain
  wallet.js
  notifications.js
  ...
```

Each domain module exports:

- **query options factories** (`auctionQueries.detail(id)`) built with `queryOptions()`, so the same definition works in `useQuery`, `prefetchQuery`, `ensureQueryData` (route loaders) and `setQueryData` with full key/type agreement;
- **hooks** (`useAuction(id)`) that wrap the options and add realtime subscriptions when the data is live;
- **mutation hooks** (`usePlaceBid(id)`) that invalidate or update the affected keys on success.

Keys come from `keys.js` so invalidation can target a whole domain (`["auctions"]`) or one item (`["auctions", "detail", id]`). Existing hooks like `useWallet` can stay where they are; move them only if you are already editing them substantially, and keep a re-export at the old path so imports don't break.

Concrete templates for all of this are in `references/patterns.md` — read it before writing the module.

## Freshness guide

| Data | staleTime | Poll | Realtime |
|---|---|---|---|
| Site config: settings, theme, categories, content | `Infinity` or 5–10 min | no | only if admins edit it live (`useContent`, `currency.jsx` already subscribe) |
| Lists of auctions, user's joined auctions | 30–60 s | no | filtered (`id=in.(…)`) when the UI reacts to changes |
| Single live auction, its bids | 5–10 s | optional slow safety poll (≥15 s) | yes, filtered by `id` / `auction_id`, apply payloads with `setQueryData` |
| Wallet balance, notifications | 15 s | 60 s safety net | yes, filtered by `user_id` |
| Admin tables / reports | 30 s+ | only on dashboards that claim to be "live", ≥20 s | prefer invalidate on event, throttled |

Polling is a safety net for missed realtime events, not the main update path. When both exist, keep the poll slow.

## Rules that matter here and why

- **Polling goes through `refetchInterval`, never `setInterval` + fetch.** The query handles dedupe across components and, with `refetchIntervalInBackground: false`, stops when the tab is hidden. A hand-written interval in a component mounted in `Layout`/`SiteHeader` runs on every page for every user.
- **Clock ticks are not data fetching.** `setInterval(() => setNow(Date.now()), 1000)` for countdowns should use the shared `useNow()` from `src/lib/useNow.js`, not a per-component timer — but it never belongs in a query.
- **Realtime always filters on the server** (`subscribe(cb, { filter: "auction_id=eq.<id>" })`). An unfiltered subscription sends every row change on the site to every viewer. `subscribe()` already shares one channel per table+filter, so call it from the hook, not from each component.
- **Apply the payload when you can, invalidate when you can't.** If the event carries the full row (tables with `REPLICA IDENTITY FULL`, e.g. `wallet_transactions`), merge it with `setQueryData`. If the screen shows aggregates (balance, totals), invalidate with `{ cancelRefetch: false }` so a burst of events shares one in-flight request.
- **Pass `onReconnect`** to `subscribe()` and invalidate there: a dropped channel misses events, and the reconnect is the moment to catch up.
- **Put auth in the key when the result depends on it.** Auction reads switch between `auctions` and the `auctions_public` view depending on whether there is a session, and bids return `[]` when signed out. Include `userId` (or `"anon"`) in the key, or clear the cache on sign-in/out, so a signed-out result is never served to a signed-in user.
- **Dependent queries use `enabled`**, never a conditional hook call: `enabled: !!userId`.
- **Derive with `select`**, don't copy query data into `useState`. Copying breaks the "cache is the source of truth" rule and leads to stale UI after invalidation.
- **Writes go through `useMutation`** and finish with `invalidateQueries` (or `setQueryData` for optimistic updates with rollback in `onError`). Don't call the entity method and then manually re-run a `load()` function.
- **Don't double-cache.** `base44Client.ts` has its own 60 s `cachedRead` for config tables (`site_settings`, `themes`, `contents`, ...). When TanStack Query owns that data, its `staleTime` already dedupes; don't add a third cache layer on top.
- **Use the provided client.** The `QueryClient` the app actually uses is created in `src/router.tsx` (with library defaults: `refetchOnWindowFocus: true`, `retry: 3`). `src/lib/query-client.js` is not wired to the provider. If defaults need changing, change them in `router.tsx` and mention it in the report, since it affects every query.

## Routing (TanStack Router)

The app is TanStack Start in **SPA mode**: a static bundle on cPanel with no server runtime, so loaders and `beforeLoad` run in the browser and `createServerFn` has nowhere to run. Routes are files in `src/routes/` and `routeTree.gen.ts` is generated. The router context already carries `queryClient`. Most pages still import `react-router-dom`, which is aliased to the untyped shim in `src/lib/router-compat.tsx`.

Read `references/router.md` before touching a route. The short version:

- **Route files stay thin**: options + an imported page. Keep `ssr: false` on anything that needs the Supabase session or `window`.
- **Loader warms, component reads.** `loader: ({ context: { queryClient }, params }) => queryClient.ensureQueryData(xQueries.detail(params.id))`, and the component calls `useQuery`/`useSuspenseQuery` with the *same* options object. Leave `defaultPreloadStaleTime: 0` alone; Query's `staleTime` decides freshness. Realtime and polling stay in hooks, not loaders.
- **URL state lives in search params**: `validateSearch` (a small hand-written parser; no zod in the repo), `route.useSearch()`, `navigate({ search: (prev) => ({ ...prev, … }) })`, and `loaderDeps` when the loader depends on them.
- **Typed params and links**: `getRouteApi("/_app/auction/$id").useParams()` inside `src/pages/`, and `<Link to="/auction/$id" params={{ id }}>`, never string-built paths. `preload="intent"` on links into data-heavy pages.
- **Guards belong in `beforeLoad`** with `throw redirect(...)`. `_app.tsx` currently guards inside the component. Moving that is a structural change, so propose it rather than doing it on the side.
- **Missing rows → `throw notFound()`** from the loader. Use `pendingComponent` for skeletons and `errorComponent` with `router.invalidate()` to retry.
- **Migrate a page off the shim completely or not at all.** Don't mix shim and native imports in one file, and don't sweep the repo unless asked.

## Things to leave alone unless asked

- Server-side work in `supabase/functions/` and the pg_cron `auction-tick` job (that's where `winner_payments` reads come from, not the browser).
- Realtime publication / RLS migrations — those are database changes and need their own review.
- Admin screens' timers that were deliberately deferred in `OPTIMIZATION-TODO.md`, unless the task targets them.
- Global router settings in `src/router.tsx` (`defaultPreload`, `defaultPreloadStaleTime`, QueryClient defaults): change them only when the task calls for it, and always say so in the report.
