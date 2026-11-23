# TanStack Router in this repo

## Contents
1. How routing is set up here
2. Route file shape
3. Loaders + TanStack Query
4. Typed params and search params
5. Navigation and links
6. Auth guards with beforeLoad
7. Not found, errors, pending
8. Migrating a page off the react-router shim
9. Things not to do

---

## 1. How routing is set up here

- **TanStack Start in SPA mode** (`vite.config.ts`: `spa: { enabled: true }`). The build emits a static client bundle and an HTML shell served from cPanel. **There is no server runtime in production.** Loaders and `beforeLoad` run in the browser; `createServerFn` and server routes have nowhere to run. Backend logic lives in `supabase/functions/api`.
- **File-based routes** in `src/routes/` (see `src/routes/README.md`). `routeTree.gen.ts` is generated; never edit it.
- **Pathless layout `_app`** (`_app.tsx`) wraps the signed-in area and renders `Layout`. Its URLs don't include `_app`: `_app.auction.$id.tsx` is `/auction/$id`.
- **`admin_.$section`**: the trailing `_` un-nests it from `admin.tsx`, so it doesn't render inside the admin route's component.
- **`ssr: false`** on `_app`, `admin`, `index` and similar: they need the browser's Supabase session, `window` or `localStorage`. Children inherit it. Keep `ssr: false` on any new route that reads the session.
- **The build prerenders the HTML shell in Node**, where supabase-js can't start. `src/lib/supabase.ts` creates clients lazily for that reason. Never call the client or `base44` at the top level of a route file. Only call them inside `loader`/`beforeLoad`/components of `ssr: false` routes.
- **Two Supabase sessions**: `supabase` for the customer site, `supabaseAdmin` for `/admin*`. Guards and loaders for admin routes must check the admin client.
- **Router context** carries `queryClient` (`src/router.tsx`, typed in `__root.tsx` via `createRootRouteWithContext<{ queryClient: QueryClient }>()`). `defaultPreloadStaleTime: 0` is intentional: the router always calls the loader on preload and **TanStack Query decides** whether the data is fresh. Keep it.
- **Compat shim**: most pages in `src/pages/` were ported from react-router and import `react-router-dom`, which Vite aliases to `src/lib/router-compat.tsx`. It works, but its `Link`/`useParams`/`useSearchParams` are untyped strings.

## 2. Route file shape

Route files stay thin: route options + an imported page component. Heavy UI lives in `src/pages/` or `src/components/`, so it lands in its own chunk.

```tsx
// src/routes/_app.auction.$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import AuctionDetail from "@/pages/AuctionDetail";
import { auctionQueries } from "@/lib/queries/auctions";

export const Route = createFileRoute("/_app/auction/$id")({
  head: () => ({ meta: [{ title: "Auction room | Mazad Atna" }] }),
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(auctionQueries.detail(params.id)),
  component: AuctionDetail,
});
```

Order inside the options object: `ssr`, `validateSearch`, `beforeLoad`, `loaderDeps`, `loader`, `head`, `pendingComponent`/`errorComponent`/`notFoundComponent`, `component`. The order is for readability; the types don't need it.

## 3. Loaders + TanStack Query

The loader **warms the cache**; the component **reads the cache**. Both use the same `queryOptions` object from `src/lib/queries/`, so the key can't drift.

```tsx
loader: ({ context: { queryClient }, params }) =>
  queryClient.ensureQueryData(auctionQueries.detail(params.id)),

// component
const { id } = Route.useParams();
const { data: auction } = useSuspenseQuery(auctionQueries.detail(id)); // data is never undefined
```

- `ensureQueryData` returns cached data when it's fresh and fetches otherwise. Use `prefetchQuery` (doesn't throw, doesn't return) for **secondary** data the page can render without.
- Await only what the first paint needs. Kick off the rest without awaiting so it doesn't block navigation:
  ```tsx
  loader: async ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(bidQueries.byAuction(params.id)); // not awaited
    await queryClient.ensureQueryData(auctionQueries.detail(params.id));
  },
  ```
- **Search-driven data** uses `loaderDeps`, so the loader re-runs when those search params change:
  ```tsx
  validateSearch: parseAuctionSearch,
  loaderDeps: ({ search }) => ({ status: search.status, page: search.page }),
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(auctionQueries.list(deps)),
  ```
- **Live data stays in hooks.** Realtime subscriptions and `refetchInterval` belong in the component's hook (`useLiveAuction`), not in the loader. Loaders run once per navigation.
- **Session-dependent reads**: auction reads switch to `auctions_public` with no session. Inside `_app`, guard with `beforeLoad` first (section 6) so a loader never caches a signed-out result. Otherwise skip the loader for that query.
- Don't use the loader's return value as the page's data source (`Route.useLoaderData()`) for anything that realtime or mutations update. Keep TanStack Query the single cache. Return values are fine for static, route-only values.

## 4. Typed params and search params

**Params**: in the route's own component, use `Route.useParams()`. A page in `src/pages/` that is imported by the route file can't import `Route` without a circular import. Use `getRouteApi`:

```jsx
import { getRouteApi } from "@tanstack/react-router";
const route = getRouteApi("/_app/auction/$id");

export default function AuctionDetail() {
  const { id } = route.useParams();
  const search = route.useSearch();
}
```

**Search params**: validate them on the route and read them typed. No validation library is installed. Write a small parser rather than adding a dependency without asking:

```ts
type AuctionSearch = { status?: "live" | "upcoming" | "ended"; page: number; q?: string };

export function parseAuctionSearch(raw: Record<string, unknown>): AuctionSearch {
  const status = ["live", "upcoming", "ended"].includes(raw.status as string)
    ? (raw.status as AuctionSearch["status"])
    : undefined;
  const page = Math.max(1, Number(raw.page) || 1);
  const q = typeof raw.q === "string" && raw.q.trim() ? raw.q.trim() : undefined;
  return { status, page, q };
}
```

Update them with the functional form, so other params survive:

```ts
navigate({ search: (prev) => ({ ...prev, status: "live", page: 1 }) });
```

Use this instead of `new URLSearchParams(location.search)` / the shim's `useSearchParams`. URL state (tabs, filters, page number) belongs in search params, not `useState`, so links and back/forward work.

## 5. Navigation and links

```tsx
import { Link, useNavigate } from "@tanstack/react-router";

<Link to="/auction/$id" params={{ id: auction.id }} preload="intent">…</Link>
<Link to="/auctions" search={(prev) => ({ ...prev, status: "live" })} activeProps={{ className: "font-bold" }}>Live</Link>

const navigate = useNavigate();
navigate({ to: "/auction/$id", params: { id }, replace: true });
```

- Use route templates plus `params`, never string-built paths (`` `/auction/${id}` ``). The type checker catches broken links that way.
- `preload="intent"` runs the target's loader on hover/touch. Combined with section 3 the next page often opens with data already cached. To make it the default, set `defaultPreload: "intent"` in `src/router.tsx`. That's a global change, so call it out in the report.
- Active styles use `activeProps` / `useMatchRoute`, not comparing `location.pathname` by hand.
- In route-aware code, redirect with `throw redirect({ to: "/login" })` (in `beforeLoad`/`loader`) or `<Navigate to="…" />`, not `window.location`.

## 6. Auth guards with beforeLoad

Today `_app.tsx` checks auth inside the component and renders `<Navigate to="/login" />`. So the child loaders and page render start before the check finishes. The router-native shape is a guard in `beforeLoad`, which runs before any child loader:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession(); // local read, no network on a valid session
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { userId: data.session.user.id }; // merged into context for child loaders
  },
  component: AppLayout,
});
```

Child loaders then get `context.userId`, which is what viewer-dependent query keys need.

This is a **structural change**. Moving the guard changes when redirects happen and how `src/lib/authReturnTo.js` gets the return path. Suspended / not-registered checks still need the profile from `AuthContext`, so they stay in the component. Propose it, and make it only when the task is about auth or routing, or the user agrees. Check the actual export name in `src/lib/supabase.ts` first.

## 7. Not found, errors, pending

- When a loader's fetch means "doesn't exist", throw `notFound()` so the route's `notFoundComponent` (or the root's) renders:
  ```tsx
  loader: async ({ context: { queryClient }, params }) => {
    try { await queryClient.ensureQueryData(auctionQueries.detail(params.id)); }
    catch (e) { if (e?.message === "not_found") throw notFound(); throw e; }
  },
  ```
  (`base44.entities.X.get` throws `Error("not_found")` for a missing row.)
- Give data-heavy routes a `pendingComponent` (a skeleton) instead of a spinner inside the page. The router shows it only after `pendingMs` (1 s default), so fast navigations don't flash.
- Route `errorComponent` receives `{ error, reset }`. On retry, call `router.invalidate()` (and `queryClient.resetQueries` for the failed key) rather than reloading the page.

## 8. Migrating a page off the react-router shim

Migrate a file **completely** when you're already changing it substantially. Don't mix shim and native imports in one file, and don't run a repo-wide sweep unless asked.

| Shim (`react-router-dom`) | Native (`@tanstack/react-router`) |
|---|---|
| `useParams()` | `route.useParams()` via `getRouteApi("/_app/…")` |
| `useSearchParams()` | `validateSearch` + `route.useSearch()` + `navigate({ search })` |
| `useNavigate()("/x")` | `useNavigate()({ to: "/x" })` |
| `<Link to={`/auction/${id}`}>` | `<Link to="/auction/$id" params={{ id }}>` |
| `useLocation().pathname` | `useRouterState({ select: (s) => s.location.pathname })` or `useMatchRoute` |
| `useOutletContext()` (Layout → pages) | leave it until that layout's consumers are migrated together; better long-term: route context or a query hook |

Keep the shim file itself. Other pages still depend on it.

## 9. Things not to do

- Don't create `src/pages/*.tsx` routes, `app/layout.tsx`, or a second root. Routes only exist in `src/routes/`.
- Don't edit `routeTree.gen.ts`. If it's stale, run the dev server or a build to regenerate it.
- Don't use `createServerFn`, server routes or SSR-only APIs. Nothing runs on a server in production.
- Don't fetch in a loader and also fetch in a `useEffect` in the component. Pick the query, and read it in both places.
- Don't remove `<Outlet />` from `__root.tsx` or `_app` layouts.
- Don't add a validation library (zod, valibot) or a router plugin without asking.
