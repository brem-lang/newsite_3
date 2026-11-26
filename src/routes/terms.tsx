import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";
import { configQueries } from "@/lib/queries/config";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Mazady" },
      {
        name: "description",
        content:
          "Terms of Service for Mazady auctions: entry fees, bidding rules, wallet balance, refunds and fair-use policy.",
      },
      { property: "og:title", content: "Terms of Service — Mazady" },
      {
        property: "og:description",
        content: "How entry fees, bids, wallet balance and refunds work on Mazady.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Load the CMS pages before the route renders, so the page opens with its
  // final text (no skeleton, no flash of the built-in copy). A failed read
  // falls back to the built-in text.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(configQueries.pages()).catch(() => null),
  component: () => <LegalPage kind="terms" />,
});
