import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Payload = Record<string, any>;

/**
 * Single RPC entry point that replaces the old edge functions.
 * Handlers live in ./backend/handlers.server.ts (server-only).
 */
export const invokeBackend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; payload?: Payload }) => {
    if (!input || typeof input.name !== "string") throw new Error("Missing function name");
    return { name: input.name, payload: input.payload ?? {} };
  })
  .handler(async ({ data, context }) => {
    const { runBackendFunction } = await import("./backend/handlers.server");
    return runBackendFunction(data.name, data.payload, context.userId);
  });
