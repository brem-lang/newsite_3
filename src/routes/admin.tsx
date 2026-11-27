import { createFileRoute } from "@tanstack/react-router";
import { adminQueries, systemEventsQuery } from "@/lib/queries/admin";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";
import AdminGate from "@/components/AdminGate";
import { loadPanel, preloadPanel } from "@/lib/adminPanels";
import { DEFAULT_SECTION } from "@/lib/adminNav";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Admin overview | BidKita" },
      { name: "description", content: "Manage BidKita auctions, revenue, participants, and operations." },
      { property: "og:title", content: "Admin overview | BidKita" },
      { property: "og:description", content: "Manage BidKita auctions, revenue, participants, and operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Staff capability check (AdminGate reads the same cached query) and the
  // default panel's code in parallel, then (for staff) the panel's data, so it
  // opens fully loaded with no skeleton.
  loader: async ({ context: { queryClient } }) => {
    const [caps] = await Promise.all([
      queryClient.ensureQueryData(adminQueries.capabilities()),
      preloadPanel(DEFAULT_SECTION),
    ]);
    // The header bell's system events load with the panel (staff only).
    await Promise.all([
      loadPanel(DEFAULT_SECTION, queryClient, !!caps),
      caps ? queryClient.fetchQuery(systemEventsQuery()).catch(() => null) : null,
    ]);
  },
  // Until the staff check returns we don't know whether the login form or the
  // dashboard comes next, so show the neutral brand loader, not a dashboard.
  pendingComponent: AppShellSkeleton,
  component: AdminGate,
});
