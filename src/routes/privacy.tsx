import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/pages/LegalPage";

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
  component: () => <LegalPage kind="privacy" />,
});
