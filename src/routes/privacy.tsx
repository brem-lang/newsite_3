import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";
import { configQueries } from "@/lib/queries/config";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BidKita" },
      {
        name: "description",
        content:
          "Privacy Policy for BidKita: what data we collect, how we use it, what other bidders can see, and how to delete your account.",
      },
      { property: "og:title", content: "Privacy Policy — BidKita" },
      {
        property: "og:description",
        content: "What data BidKita collects, how it is used, and the choices you have.",
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
  component: () => <LegalPage kind="privacy" />,
});
