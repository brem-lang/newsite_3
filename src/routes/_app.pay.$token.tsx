import { createFileRoute } from "@tanstack/react-router";
import { auctionQueries } from "@/lib/queries/auctions";
import WinnerPayment from "@/pages/WinnerPayment";

export const Route = createFileRoute("/_app/pay/$token")({
  head: () => ({
    meta: [
      { title: "Complete your auction payment | BidKita" },
      {
        name: "description",
        content:
          "Review the amount due for the auction you won and send your details so our team can confirm your payment and delivery.",
      },
      { property: "og:title", content: "Complete your auction payment | BidKita" },
      {
        property: "og:description",
        content: "Review the amount due for the auction you won and finish your payment with our team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Waits for the payment, but never fails the route: an invalid link is
  // shown by the page itself (it reads the query's error).
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(auctionQueries.paymentByToken(params.token)).catch(() => null);
  },
  component: WinnerPayment,
});
