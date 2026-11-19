# Mazady

Auction web app: TanStack Start (static SPA) + Supabase.

## Development

Requires Node.js and [Bun](https://bun.sh) (`bun.lock` is the lockfile).

```sh
bun install
bun run dev      # http://localhost:8080
```

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
In development, Supabase calls are proxied through the dev server. Set `VITE_SUPABASE_DEV_PROXY=false` to call Supabase directly.

## Build

```sh
bun run build    # static output in dist/client
```

`dist/client` can be served by any static host (Apache/cPanel).
