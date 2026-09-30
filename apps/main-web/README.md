# @tera/main (apps/main-web)

Main web app built with [vinext](https://github.com/cloudflare/vinext) (Next.js-style App Router on
Vite) and deployed to Cloudflare Workers as the `main-web` Worker.

## Scripts

- `pnpm run dev` — start the vinext dev server.
- `pnpm run build` — build the Cloudflare Worker output.
- `pnpm run start` — preview the built Worker locally.
- `pnpm run deploy` — deploy to Cloudflare Workers (`vinext-cloudflare deploy`).
- `pnpm run deploy:preview` — deploy to a preview URL.

## Deploy auth

First-time deploy requires Cloudflare authentication, either:

- `pnpm exec cf auth login` (interactive), or
- `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`) env vars for CI.

## Notes

- Worker config lives in `cloudflare.config.ts` (the modern `cf`-based config, no `wrangler.jsonc`).
- Generated Worker types are written to `.cloudflare/types` and included by `tsconfig.json`.
- The RSC environment runs in workerd via `@cloudflare/vite-plugin` (see `vite.config.ts`).
- Access Workers bindings from server code via `import { env } from "cloudflare:workers"`.
