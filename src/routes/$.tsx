import { createFileRoute } from "@tanstack/react-router";
import PageNotFound from "@/lib/PageNotFound";

export const Route = createFileRoute("/$")({
  ssr: false,
  component: PageNotFound,
});
