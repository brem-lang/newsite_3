import { createFileRoute } from "@tanstack/react-router";
import { parseReturnToSearch } from "@/lib/search";
import Login from "@/pages/Login";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — BidKita" },
      { name: "description", content: "Log in to your BidKita account to join live auctions, place bids and manage your wallet." },
      { property: "og:title", content: "Log in — BidKita" },
      { property: "og:description", content: "Log in to your BidKita account to join live auctions, place bids and manage your wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  validateSearch: parseReturnToSearch,
  component: Login,
});
