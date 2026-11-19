import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Local development: the dev server forwards Supabase calls to the real
 * Supabase site, so the browser only talks to localhost (no CORS). This also
 * avoids cPanel's "technical domain" page, which blocks browser requests to
 * *.cpanel.site that don't carry its cookie. Set VITE_SUPABASE_DEV_PROXY=false
 * to call VITE_SUPABASE_URL directly instead.
 */
const env = loadEnv(
  process.env["NODE_ENV"] === "production" ? "production" : "development",
  process.cwd(),
  "",
);
const supabaseTarget = (env["VITE_SUPABASE_URL"] || "").replace(/\/+$/, "");
const useDevProxy = !!supabaseTarget && env["VITE_SUPABASE_DEV_PROXY"] !== "false";

const supabaseRoute = (ws = false) => ({
  target: supabaseTarget,
  changeOrigin: true,
  secure: true,
  ws,
  headers: { Cookie: "cpanel_tech_domain=1" },
});

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Keep server-only modules out of the client bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Static single-page app: the build emits a client bundle plus an HTML shell
      // that any static host (Apache/cPanel) can serve. No server runtime is deployed.
      spa: { enabled: true },
    }),
    viteReact(),
  ],
  define: {
    __SUPABASE_DEV_PROXY__: JSON.stringify(useDevProxy),
  },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The ported pages were written against react-router; map it to our
      // TanStack Router compatibility layer.
      "react-router-dom": path.resolve(__dirname, "src/lib/router-compat.tsx"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    host: "::",
    port: 8080,
    proxy: useDevProxy
      ? {
          "/auth/v1": supabaseRoute(),
          "/rest/v1": supabaseRoute(),
          "/functions/v1": supabaseRoute(),
          "/storage/v1": supabaseRoute(),
          "/realtime/v1": supabaseRoute(true),
        }
      : {},
  },
});
