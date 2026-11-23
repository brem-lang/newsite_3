import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { auctionQueries } from "@/lib/queries/auctions";
import { configQueries } from "@/lib/queries/config";
import Home from "@/pages/Home";
import { AppShellSkeleton } from "@/components/skeletons/PageSkeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mazady — Live Online Auctions" },
      { name: "description", content: "Join live online auctions on Mazady: reserve a seat, bid in real time, and win phones, watches, cars and jewellery." },
      { property: "og:title", content: "Mazady — Live Online Auctions" },
      { property: "og:description", content: "Join live online auctions on Mazady: reserve a seat, bid in real time, and win phones, watches, cars and jewellery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  // Signed-in visitors go straight to their dashboard, before anything renders.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home", replace: true });
  },
  // Shown only if the session check is slow (e.g. a token refresh); the visitor
  // may land here or be redirected to /home, so don't guess a page layout.
  // Signed-out visitors only (signed-in ones were redirected above): load the
  // public auction list (the same limit Home.jsx reads) and site content first.
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(auctionQueries.list(undefined, 50)),
      queryClient.ensureQueryData(configQueries.content()).catch(() => null),
    ]);
  },
  pendingComponent: AppShellSkeleton,
  component: Home,
});

