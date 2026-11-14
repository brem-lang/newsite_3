import { createFileRoute } from "@tanstack/react-router";
import Deposit from "@/pages/Deposit";

export const Route = createFileRoute("/_app/deposit")({
  head: () => ({
    meta: [
      { title: "Add funds to your wallet | Mazad Atna" },
      { name: "description", content: "Deposit money into your Mazad Atna wallet to join auction seats and place bids." },
      { property: "og:title", content: "Add funds to your wallet | Mazad Atna" },
      { property: "og:description", content: "Deposit money into your Mazad Atna wallet to join auction seats and place bids." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Deposit,
});
