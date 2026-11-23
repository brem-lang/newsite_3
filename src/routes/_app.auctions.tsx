import { createFileRoute } from "@tanstack/react-router";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import { walletQueries } from "@/lib/queries/wallet";
import { parseAuctionsSearch } from "@/lib/search";
import Auctions from "@/pages/Auctions";

const title = "Live auctions | Mazad Atna";
const description =
  "Browse every live auction on Mazad Atna: rising-price rounds and sealed closest-to-price rounds, with seats, timers and current prices.";

export const Route = createFileRoute("/_app/auctions")({
  // tab / sort / q / category are URL state: shareable, back/forward-safe.
  validateSearch: parseAuctionsSearch,
  // Filtering happens in the browser over one cached list, so the loader does
  // not depend on the search params.
  loader: async ({ context: { queryClient, userId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(auctionQueries.list(userId)),
      queryClient.ensureQueryData(bidQueries.summary(userId)), // "mine" tab + stats
      queryClient.ensureQueryData(walletQueries.balance(userId)), // join affordability
    ]);
  },
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
  component: Auctions,
});
