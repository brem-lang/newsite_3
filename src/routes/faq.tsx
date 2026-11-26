import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";
import { configQueries } from "@/lib/queries/config";

// Content comes from admin → Pages (slug "faq"); nothing is shown until a
// page with that slug is published.
export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Mazady" },
      { name: "description", content: "Frequently asked questions about Mazady auctions, entry fees, bidding and payments." },
      { property: "og:title", content: "FAQ — Mazady" },
      { property: "og:description", content: "Frequently asked questions about Mazady auctions, entry fees, bidding and payments." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Load the CMS pages before the route renders, so the page opens with its
  // final text (no skeleton, no flash of the built-in copy). A failed read
  // falls back to the built-in text.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(configQueries.pages()).catch(() => null),
  component: () => <LegalPage kind="faq" />,
});
