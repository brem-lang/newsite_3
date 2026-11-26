import { createFileRoute } from "@tanstack/react-router";
import { walletQueries } from "@/lib/queries/wallet";
import { configQueries } from "@/lib/queries/config";
import { parseWalletSearch } from "@/lib/search";
import Wallet from "@/pages/Wallet";

const title = "Your wallet | BidKita";
const description =
  "Check your BidKita balance, deposits, entry and bid fees, refunds and every wallet transaction.";

export const Route = createFileRoute("/_app/wallet")({
  // Stripe checkout returns here with ?session_id=…&method_id=….
  validateSearch: parseWalletSearch,
  loader: async ({ context: { queryClient, userId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(walletQueries.transactions(userId)),
      queryClient.ensureQueryData(walletQueries.balance(userId)),
      queryClient.ensureQueryData(walletQueries.refunds(userId)),
      queryClient.ensureQueryData(configQueries.paymentMethods()),
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
  component: Wallet,
});
