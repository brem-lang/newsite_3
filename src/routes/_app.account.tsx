import { createFileRoute } from "@tanstack/react-router";
import { auctionQueries, bidQueries } from "@/lib/queries/auctions";
import { accountQueries } from "@/lib/queries/account";
import Account from "@/pages/Account";

const title = "Your account | Mazad Atna";
const description =
  "Manage your Mazad Atna profile, contact details, address, verification status and password.";

export const Route = createFileRoute("/_app/account")({
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
  loader: async ({ context: { queryClient, userId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(accountQueries.me()),
      queryClient.ensureQueryData(bidQueries.mine(userId)),
      queryClient.ensureQueryData(auctionQueries.list(userId)),
    ]);
  },
  component: Account,
});
