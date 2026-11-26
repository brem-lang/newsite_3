import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";
import { configQueries } from "@/lib/queries/config";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Mazady" },
      {
        name: "description",
        content:
          "Privacy Policy for Mazady: what data we collect, how we use it, what other bidders can see, and how to delete your account.",
      },
      { property: "og:title", content: "Privacy Policy — Mazady" },
      {
        property: "og:description",
        content: "What data Mazady collects, how it is used, and the choices you have.",
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
