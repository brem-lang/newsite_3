import { createFileRoute } from "@tanstack/react-router";
import AdminGate from "@/components/AdminGate";

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
  component: AdminGate,
});
