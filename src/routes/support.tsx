import { createFileRoute } from "@tanstack/react-router";
import SupportPage from "@/pages/SupportPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Help & Support — BidKita" },
      {
        name: "description",
        content:
          "Get help with BidKita auctions, wallet deposits, bidding rules and winner claims.",
      },
      { property: "og:title", content: "Help & Support — BidKita" },
      {
        property: "og:description",
        content:
          "Answers to common questions and how to contact the BidKita support team.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});
