---
title: "Provider avatars need the api kind, so every usage view must send it"
author: Masb0ymas
date: 2026-11-07
branch: dev
cost: { minutes: 19, tokens: 155334 }
id: l-df8fbad8
scope: repo
status: active
src: agent
touches:
  - apps/web-ui/src/components/block/providers/oauth-poll-dialog.tsx
  - apps/web-ui/src/lib/api/models/account.ts
  - apps/server/internal/connectors/connector.go
  - apps/server/internal/connectors/zcode_test.go
  - apps/server/internal/handlers/oauth.go
  - apps/server/internal/oauth/device.go
  - apps/server/internal/oauth/device_test.go
  - apps/server/internal/oauth/zcode_plan.go
  - design/design.pen
  - apps/server/internal/handlers/portal.go
---

## Decided
Nov 7: the public usage portal reuses the /usage request detail dialog and the shared ReactTable. Portal rows are mapped to the /usage row shape on the client instead of building a second dialog.
The portal request log gained id, cache read/write, reasoning tokens, the budget-drain rate and api_kind. These are token counts and a wire dialect only; client IP and error text still stay out, since anyone holding the link can read it.

## Watch out
A provider avatar picks its logo from the slug first and the api kind second. A view that sends only the slug shows a bare letter for custom providers (slugs that don't name openai/anthropic), while /providers shows the logo. Any new endpoint that feeds avatars must send api_kind; the server builds the slug-to-kind map with providerMeta.
The /portal route validates only ?id, but TanStack Router keeps unknown search keys, so the ReactTable pager's ?page / ?pageSize work there without listing them.

In the code:
- apps/server/internal/handlers/portal.go: fills APIKind via (&usageHandler{app: h.app}).providerMeta(ctx)
- apps/server/internal/repositories/usage_key.go: KeyRequest / KeyModelUsage
- apps/web-ui/src/components/block/portal/portal-panels.tsx: toDetailRow maps a portal row to UsageTerminalRequestRow
- apps/web-ui/src/components/block/portal/recent/column.tsx: columns, structured like traffic/pricing/column.tsx
- apps/web-ui/src/components/block/providers/provider-avatar.tsx: getProviderBrand(slug, apiKind)
