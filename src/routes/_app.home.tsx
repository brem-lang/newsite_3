import { createFileRoute } from "@tanstack/react-router";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import { walletQueries } from "@/lib/queries/wallet";
import Dashboard from "@/pages/Dashboard";
import { feedAuctionIds } from "@/lib/homeHighlights";

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
  // Everything the dashboard paints is loaded before it renders (in
  // parallel), so it never shows a skeleton or an early "nothing here".
  // The live bid feed needs the auction list first (it reads the live ones).
  loader: async ({ context: { queryClient, userId } }) => {
    await Promise.all([
      queryClient
        .ensureQueryData(auctionQueries.list(userId))
        .then((auctions) => queryClient.ensureQueryData(bidQueries.recent(userId, feedAuctionIds(auctions || [])))),
      queryClient.ensureQueryData(bidQueries.summary(userId)),
      queryClient.ensureQueryData(walletQueries.balance(userId)),
      queryClient.ensureQueryData(walletQueries.transactions(userId)),
    ]);
  },
  component: Dashboard,
});
