import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const __SUPABASE_DEV_PROXY__: boolean | undefined;

// Self-hosted Supabase, served from the site's own origin through the Apache
// proxy (/auth/v1, /rest/v1, /functions/v1, /storage/v1, /realtime/v1).
// In local development the Vite dev server proxies those same paths (see
// vite.config.ts), so calls go to the page's own origin and avoid CORS.
const viaDevProxy = typeof __SUPABASE_DEV_PROXY__ !== "undefined" && __SUPABASE_DEV_PROXY__ && import.meta.env.DEV;
const SUPABASE_URL =
  (viaDevProxy ? "" : import.meta.env['VITE_SUPABASE_URL']) ||
  (typeof window !== "undefined" ? window.location.origin : "");
const SUPABASE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || "";

if (!SUPABASE_KEY && typeof window !== "undefined") console.warn("VITE_SUPABASE_PUBLISHABLE_KEY is not set; sign-in will fail.");

const memoryStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const browserStorage = (pick: () => Storage) => {
  try {
    const s = pick();
    s.getItem("probe");
    return s;
  } catch {
    return memoryStorage();
  }
};

/**
 * Clients are created on first use, never at import time: the build prerenders
 * the HTML shell in Node, where supabase-js cannot start.
 */
function lazy(make: () => SupabaseClient): SupabaseClient {
  let client: SupabaseClient | null = null;
  return new Proxy({} as SupabaseClient, {
    get(_t, prop) {
      client ??= make();
      const value = Reflect.get(client, prop);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

/** Customer session: kept across reloads and tabs. */
export const supabase = lazy(() => createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: "bidkita-auth",
    storage: browserStorage(() => window.localStorage),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}));

/**
 * Staff session for /admin: a separate client and storage key, so signing in
 * or out of one area never affects the other. Kept per tab (sessionStorage).
 */
export const supabaseAdmin = lazy(() => createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: "bidkita-admin-auth",
    storage: browserStorage(() => window.sessionStorage),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
}));
