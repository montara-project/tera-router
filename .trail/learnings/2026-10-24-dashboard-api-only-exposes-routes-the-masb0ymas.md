---
title: Dashboard API only exposes routes the web-ui calls
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 10, tokens: 105374 }
id: l-3445b10b
scope: repo
status: active
touches:
  - apps/docs/content/docs/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/id-ID/api-reference/dashboard-api.mdx
  - apps/server/cmd/api/routes.go
  - apps/server/internal/handlers/accounts.go
  - apps/web-ui/src/lib/api/services/account.ts
  - apps/web-ui/src/lib/api/services/types/account.ts
  - apps/web-ui/src/lib/auth/handler.ts
---

## Decided
- Oct 24: `/v1` dashboard routes in `apps/server/cmd/api/routes.go` were pruned to what `apps/web-ui/src/lib/api/services/*` actually calls. Removed: `/validate-key`, `/accounts/bulk`, `/accounts/:id/quota/reset`, `/providers/:id/accounts/{disable-all,enable-all,disabled,all}`, `GET /plans/:id`, `/plans/:id/keys`, `/chains/:id/usage`, `/providers/rates`, `GET /usage`, `/usage/models`, `/usage/insights`, `PUT|PATCH /proxy-pools/:id`, and the duplicate PUT (or PATCH for chains) aliases. Handlers, DTOs, web-ui services/types and dashboard-api.mdx (EN + id-ID) went with them.
- Why: less attack surface. An endpoint with no UI is reachable only by whoever holds a dashboard JWT, so it adds risk and nothing useful.

## Watch out
- One verb per update route: chains use PUT, everything else uses PATCH. Match what the web-ui service sends.
- Budgets (`/v1/budgets*`) have no UI but were kept on purpose: the gateway enforces them (`internal/gateway/meter.go`, `resolve.go`).
- `/v1/auth/refresh` has no live caller (its refresh code is in the dead `apps/web-ui/src/lib/auth/handler.ts`) but must stay. Wire the UI to it instead.
- Before adding a dashboard endpoint, add the web-ui caller in the same change.
