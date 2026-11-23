import { createFileRoute } from "@tanstack/react-router";
import { adminQueries, systemEventsQuery } from "@/lib/queries/admin";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";
import AdminGate from "@/components/AdminGate";
import { loadPanel, preloadPanel } from "@/lib/adminPanels";

export const Route = createFileRoute("/admin_/$section")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: params.section === "settings" ? "Admin profile & settings | Mazady" : "Admin workspace | Mazady" },
      { name: "description", content: params.section === "settings" ? "Manage your Mazady admin profile, security, and platform settings." : "Manage auctions and business operations in Mazady." },
      { property: "og:title", content: params.section === "settings" ? "Admin profile & settings | Mazady" : "Admin workspace | Mazady" },
      { property: "og:description", content: params.section === "settings" ? "Manage your Mazady admin profile, security, and platform settings." : "Manage auctions and business operations in Mazady." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Staff capability check (AdminGate reads the same cached query) and the
  // panel's code in parallel, then (for staff) the panel's data. Switching
  // sections keeps the current panel on screen under the top progress bar
  // until the next one is fully loaded, so panels never show a skeleton.
  loader: async ({ context: { queryClient }, params }) => {
    const [caps] = await Promise.all([
      queryClient.ensureQueryData(adminQueries.capabilities()),
      preloadPanel(params.section),
    ]);
    // The header bell's system events load with the panel (staff only).
    await Promise.all([
      loadPanel(params.section, queryClient, !!caps),
      caps ? queryClient.ensureQueryData(systemEventsQuery()).catch(() => null) : null,
    ]);
  },
  // Until the staff check returns we don't know whether the login form or the
  // dashboard comes next, so show the neutral brand loader, not a dashboard.
  pendingComponent: AppShellSkeleton,
  component: AdminGate,
});
