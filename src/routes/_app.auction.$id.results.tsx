import { createFileRoute } from "@tanstack/react-router";
import AuctionResults from "@/pages/AuctionResults";

const title = "Auction results | Mazad Atna";
const description =
  "See how this Mazad Atna auction closed: every bid placed, the winning bid and the winner, plus the wallet payment step.";

export const Route = createFileRoute("/_app/auction/$id/results")({
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
  component: AuctionResults,
});
