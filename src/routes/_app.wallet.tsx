import { createFileRoute } from "@tanstack/react-router";
import Wallet from "@/pages/Wallet";

const title = "Your wallet | Mazad Atna";
const description =
  "Check your Mazad Atna balance, deposits, entry and bid fees, refunds and every wallet transaction.";

export const Route = createFileRoute("/_app/wallet")({
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
