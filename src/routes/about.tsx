import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";
import { configQueries } from "@/lib/queries/config";

// Content comes from admin → Pages (slug "about"); nothing is shown until a
// page with that slug is published.
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Mazady" },
      { name: "description", content: "About Mazady: who we are and how our auctions work." },
      { property: "og:title", content: "About — Mazady" },
      { property: "og:description", content: "About Mazady: who we are and how our auctions work." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Load the CMS pages before the route renders, so the page opens with its
  // final text (no skeleton, no flash of the built-in copy). A failed read
  // falls back to the built-in text.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(configQueries.pages()).catch(() => null),
  component: () => <LegalPage kind="about" />,
});
