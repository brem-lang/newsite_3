import { createFileRoute, notFound } from "@tanstack/react-router";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import { walletQueries } from "@/lib/queries/wallet";
import PageNotFound from "@/lib/PageNotFound";
import AuctionDetail from "@/pages/AuctionDetail";

const title = "Auction room | BidKita";
const description =
  "Follow this BidKita auction live: countdown, current price, your bids, seat count and the leaderboard.";

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
  loader: async ({ context: { queryClient, userId }, params }) => {
    try {
      await Promise.all([
        queryClient.ensureQueryData(auctionQueries.detail(params.id)),
        queryClient.ensureQueryData(bidQueries.byAuction(params.id)),
        queryClient.ensureQueryData(walletQueries.balance(userId)), // bid/join affordability
        // Optional for the first paint: a failure here must not block the room.
        queryClient.ensureQueryData(auctionQueries.bidState(params.id)).catch(() => null),
      ]);
    } catch (e) {
      if ((e as Error)?.message === "not_found") throw notFound();
      throw e;
    }
  },
  notFoundComponent: PageNotFound,
  component: AuctionDetail,
});
