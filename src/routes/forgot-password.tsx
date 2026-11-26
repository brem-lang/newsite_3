import { createFileRoute } from "@tanstack/react-router";
import ForgotPassword from "@/pages/ForgotPassword";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — BidKita" },
      { name: "description", content: "Request a password reset link for your BidKita account." },
      { property: "og:title", content: "Reset your password — BidKita" },
      { property: "og:description", content: "Request a password reset link for your BidKita account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ForgotPassword,
});
