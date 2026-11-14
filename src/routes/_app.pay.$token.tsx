import { createFileRoute } from "@tanstack/react-router";
import WinnerPayment from "@/pages/WinnerPayment";

export const Route = createFileRoute("/_app/pay/$token")({
  head: () => ({
    meta: [
      { title: "Complete your auction payment | Mazad Atna" },
      {
        name: "description",
        content:
          "Review the amount due for the auction you won and send your details so our team can confirm your payment and delivery.",
      },
      { property: "og:title", content: "Complete your auction payment | Mazad Atna" },
      {
        property: "og:description",
        content: "Review the amount due for the auction you won and finish your payment with our team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WinnerPayment,
});
