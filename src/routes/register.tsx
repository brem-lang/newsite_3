import { createFileRoute } from "@tanstack/react-router";
import { parseReturnToSearch } from "@/lib/search";
import Register from "@/pages/Register";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — Mazady" },
      { name: "description", content: "Sign up for Mazady in seconds and start bidding in live online auctions." },
      { property: "og:title", content: "Create your account — Mazady" },
      { property: "og:description", content: "Sign up for Mazady in seconds and start bidding in live online auctions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  validateSearch: parseReturnToSearch,
  component: Register,
});
