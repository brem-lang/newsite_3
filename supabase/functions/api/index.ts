/**
 * Single entry point for the app's server actions:
 *   POST /functions/v1/api  { name, payload }  ->  { data, status }
 *
 * The caller is identified from their Supabase session token; each handler
 * then checks what that user may do (member vs staff capabilities).
 * "auctionTick" is the scheduled job and is authorised with the private
 * token stored in public.cron_tokens instead of a user session.
 */
import { supabaseAdmin } from "./client.ts";
import { finalizeAuctions, runBackendFunction } from "./handlers.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tick-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Always HTTP 200 with the real status inside, matching what the app expects.
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, status }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function sameSecret(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  let body: { name?: unknown; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }
  const name = typeof body?.name === "string" ? body.name : "";
  if (!name) return reply({ error: "Missing function name" }, 400);

  if (name === "auctionTick") {
    const provided = req.headers.get("x-tick-token") || "";
    const { data } = await supabaseAdmin.from("cron_tokens").select("token").eq("name", "auction_tick").maybeSingle();
    const expected = (data as { token?: string } | null)?.token || "";
    if (!provided || !expected || !(await sameSecret(provided, expected))) return reply({ error: "Unauthorized" }, 401);
    return reply(await finalizeAuctions());
  }

  const jwt = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1] || "";
  const { data: auth } = jwt ? await supabaseAdmin.auth.getUser(jwt) : { data: { user: null } };
  if (!auth?.user) return reply({ error: "Unauthorized" }, 401);

  try {
    const result = await runBackendFunction(name, body.payload || {}, auth.user.id);
    return reply(result.data, result.status);
  } catch (e) {
    console.error("api", name, e);
    return reply({ error: e instanceof Error ? e.message : "server_error" }, 500);
  }
});
