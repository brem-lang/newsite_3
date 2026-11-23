import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { FirstLoadPending } from "@/components/skeletons/PageSkeleton";

/** Errors that a retry can't fix: missing rows, auth and validation failures. */
function isPermanent(error: unknown) {
  const e = error as { message?: string; status?: number; code?: string } | null;
  if (!e) return false;
  if (e.message === "not_found") return true;
  const status = Number(e.status);
  if (status >= 400 && status < 500) return true;
  // PostgREST permission / RLS errors
  return e.code === "42501" || e.code === "PGRST301";
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 30s unless a query says otherwise (see
        // src/lib/queries/*). Revisiting a page within that window is served
        // from cache with no request and no skeleton.
        staleTime: 30_000,
        // Unused data stays in memory for 5 minutes so back/forward navigation
        // renders instantly from cache.
        gcTime: 5 * 60_000,
        retry: (count, error) => !isPermanent(error) && count < 1,
        // Returning to the tab doesn't reload every page's data; only live
        // queries (wallet balance/transactions, auction room) opt back in.
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
      },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Query's staleTime decides freshness; the router always asks.
    defaultPreloadStaleTime: 0,
    // Hovering/touching a link warms the target page's data.
    defaultPreload: "intent",
    // In-app navigation keeps the current page on screen until the next
    // page's loaders finish (pendingMs Infinity); RouteProgressBar is the
    // loading indicator. The pending component only renders on the very first
    // load, when there is no page yet: the full-screen brand splash.
    defaultPendingComponent: FirstLoadPending,
    defaultPendingMs: Infinity,
  });

  return router;
};
