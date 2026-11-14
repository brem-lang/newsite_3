import { createFileRoute } from "@tanstack/react-router";
import AuctionDetail from "@/pages/AuctionDetail";

const title = "Auction room | Mazad Atna";
const description =
  "Follow this Mazad Atna auction live: countdown, current price, your bids, seat count and the leaderboard.";

export const Route = createFileRoute("/_app/auction/$id")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuctionDetail,
});
