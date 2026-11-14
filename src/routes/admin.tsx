import { createFileRoute } from "@tanstack/react-router";
import AdminGate from "@/components/AdminGate";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Admin overview | Mazady" },
      { name: "description", content: "Manage Mazady auctions, revenue, participants, and operations." },
      { property: "og:title", content: "Admin overview | Mazady" },
      { property: "og:description", content: "Manage Mazady auctions, revenue, participants, and operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGate,
});
