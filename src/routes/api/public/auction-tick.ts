import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled tick (every minute): starts due auctions, closes expired rounds,
 * requests winner payments and releases expired escrow holds.
 *
 * The caller is authorised with a private token stored server-side in
 * `cron_tokens` — it is never exposed to the browser and only the scheduler
 * and this handler can read it.
 */
export const Route = createFileRoute("/api/public/auction-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header = request.headers.get("x-tick-token") || "";
        const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
        const provided = header || match?.[1] || "";
        if (!provided) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("cron_tokens")
          .select("token")
          .eq("name", "auction_tick")
          .maybeSingle();
        const expected = (data as { token?: string } | null)?.token || "";
        if (!expected) return new Response("Server configuration error", { status: 500 });

        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
        if (!timingSafeEqual(digest(provided), digest(expected))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { finalizeAuctions } = await import("@/lib/backend/handlers.server");
        return Response.json(await finalizeAuctions());
      },
    },
  },
});
