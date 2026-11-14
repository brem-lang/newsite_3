import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";

export const Route = createFileRoute("/_app/home")({
  head: () => ({
    meta: [
      { title: "Home — Mazady" },
      {
        name: "description",
        content: "Your Mazady dashboard: wallet balance, live auctions, your active bids and recent activity.",
      },
      { property: "og:title", content: "Home — Mazady" },
      {
        property: "og:description",
        content: "Your Mazady dashboard: wallet balance, live auctions, your active bids and recent activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: Dashboard,
});
