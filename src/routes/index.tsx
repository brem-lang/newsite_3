import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/lib/AuthContext";
import Home from "@/pages/Home";

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
  component: PublicHome,
});

function PublicHome() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return <Home />;
}
