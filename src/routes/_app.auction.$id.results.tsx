import { createFileRoute, notFound } from "@tanstack/react-router";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import PageNotFound from "@/lib/PageNotFound";
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
  loader: async ({ context: { queryClient }, params }) => {
    try {
      await Promise.all([
        queryClient.ensureQueryData(auctionQueries.detail(params.id)),
        queryClient.ensureQueryData(bidQueries.allForAuction(params.id)),
        // Optional extras: a failure here must not block the results page.
        queryClient.ensureQueryData(auctionQueries.winnerPayment(params.id)).catch(() => null),
        queryClient.ensureQueryData(auctionQueries.bidState(params.id)).catch(() => null),
      ]);
    } catch (e) {
      if ((e as Error)?.message === "not_found") throw notFound();
      throw e;
    }
  },
  notFoundComponent: PageNotFound,
  component: AuctionResults,
});
