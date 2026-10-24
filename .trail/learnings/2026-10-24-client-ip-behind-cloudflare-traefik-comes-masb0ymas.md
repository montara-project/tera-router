---
title: "Client IP behind Cloudflare+Traefik comes from X-Forwarded-For, never CF-Connecting-IP"
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 7, tokens: 31980 }
id: l-2815924e
scope: repo
status: active
touches:
  - apps/docs/content/docs/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/gateway/index.mdx
  - apps/docs/content/docs/id-ID/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/id-ID/gateway/index.mdx
  - apps/docs/content/docs/concepts/plans-budgets.mdx
  - apps/docs/content/docs/concepts/providers.mdx
  - apps/docs/content/docs/id-ID/concepts/plans-budgets.mdx
  - apps/docs/content/docs/id-ID/concepts/providers.mdx
  - apps/server/cmd/api/routes.go
  - apps/server/internal/dtos/accounts.go
---

## Decided
- Real client IP is resolved by Fiber from `X-Forwarded-For` (`apps/server/cmd/api/server.go:50-62`). With `TrustProxyConfig.Proxies` set and `EnableIPValidation`, Fiber v3.5 (`req.go:726`, extractIPFromHeader) walks the header right to left and returns the first address that is not trusted. No code change is needed for Cloudflare → Traefik (Dokploy) → app: it is configuration only, documented in `apps/docs/content/docs/getting-started/docker-compose.mdx`.
- Traefik must list Cloudflare ranges in `entryPoints.*.forwardedHeaders.trustedIPs`. `TRUSTED_PROXIES` must hold the Traefik Docker subnet plus the same Cloudflare ranges.

## Tried and ruled out
- `ProxyHeader = CF-Connecting-IP`: Traefik passes that header through unchanged, so a request that hits the origin directly could forge it. `Cf-Connecting-IP` is trusted only in `middlewares.clientIP`, and only from loopback while the built-in cloudflared tunnel is up.

## Watch out
- Leave out the Traefik subnet and the header is ignored (the peer is Traefik). Leave out the Cloudflare ranges and every visitor resolves to a Cloudflare edge IP, so one bad actor's failed sign-ins block everyone (`ipblock`).
