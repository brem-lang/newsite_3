// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     VITE_* env injection, @ path alias, React/TanStack dedupe, error logger plugins,
//     and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

import path from "node:path";

/**
 * Local development: the dev server forwards Supabase calls to the real
 * Supabase site, so the browser only talks to localhost (no CORS). This also
 * avoids cPanel's "technical domain" page, which blocks browser requests to
 * *.cpanel.site that don't carry its cookie. Lovable's sandbox strips custom
 * proxies, so there the app keeps calling VITE_SUPABASE_URL directly.
 */
const env = loadEnv(process.env["NODE_ENV"] === "production" ? "production" : "development", process.cwd(), "");
const supabaseTarget = (env["VITE_SUPABASE_URL"] || "").replace(/\/+$/, "");
const inSandbox = process.env["LOVABLE_SANDBOX"] === "1" || !!process.env["SANDBOX"];
const useDevProxy = !!supabaseTarget && !inSandbox && env["VITE_SUPABASE_DEV_PROXY"] !== "false";

const supabaseRoute = (ws = false) => ({
  target: supabaseTarget,
  changeOrigin: true,
  secure: true,
  ws,
  headers: { Cookie: "cpanel_tech_domain=1" },
});

export default defineConfig({
  // Frontend-only build: no server runtime is deployed.
  nitro: false,
  vite: {
    define: {
      __SUPABASE_DEV_PROXY__: JSON.stringify(useDevProxy),
    },
    server: useDevProxy
      ? {
          proxy: {
            "/auth/v1": supabaseRoute(),
            "/rest/v1": supabaseRoute(),
            "/functions/v1": supabaseRoute(),
            "/storage/v1": supabaseRoute(),
            "/realtime/v1": supabaseRoute(true),
          },
        }
      : {},
    resolve: {
      alias: {
        // The ported pages were written against react-router; map it to our
        // TanStack Router compatibility layer.
        "react-router-dom": path.resolve(__dirname, "src/lib/router-compat.tsx"),
      },
    },
  },
  tanstackStart: {
    // Static single-page app: the build emits a client bundle plus an HTML shell
    // that any static host (Apache/cPanel) can serve.
    spa: { enabled: true },
  },
});
