import { createFileRoute } from "@tanstack/react-router";
import ForgotPassword from "@/pages/ForgotPassword";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Mazady" },
      { name: "description", content: "Request a password reset link for your Mazady account." },
      { property: "og:title", content: "Reset your password — Mazady" },
      { property: "og:description", content: "Request a password reset link for your Mazady account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ForgotPassword,
});
