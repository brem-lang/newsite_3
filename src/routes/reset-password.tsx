import { createFileRoute } from "@tanstack/react-router";
import { parseResetPasswordSearch } from "@/lib/search";
import ResetPassword from "@/pages/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — BidKita" },
      { name: "description", content: "Choose a new password for your BidKita account." },
      { property: "og:title", content: "Set a new password — BidKita" },
      { property: "og:description", content: "Choose a new password for your BidKita account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  validateSearch: parseResetPasswordSearch,
  component: ResetPassword,
});
