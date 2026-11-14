import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Cron endpoint: starts scheduled/full auctions and ends expired ones
 * (charging the winner's wallet and notifying them).
 */
export const Route = createFileRoute("/api/public/finalize-auctions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { finalizeAuctions } = await import("@/lib/backend/handlers.server");
        const result = await finalizeAuctions();
        return Response.json(result);
      },
    },
  },
});
