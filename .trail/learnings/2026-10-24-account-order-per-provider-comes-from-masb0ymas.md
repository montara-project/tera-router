---
title: Account order per provider comes from its account strategy; Router default reads Settings › Routing
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 28, tokens: 223814 }
id: l-b9aa5b1f
scope: repo
status: active
touches:
  - apps/docs/content/docs/configuration.mdx
  - apps/docs/content/docs/id-ID/configuration.mdx
  - apps/server/cmd/api/server.go
  - apps/docs/content/docs/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/concepts/api-keys.mdx
  - apps/docs/content/docs/id-ID/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/id-ID/concepts/api-keys.mdx
  - apps/server/internal/dtos/keys.go
  - apps/server/internal/handlers/auth.go
  - apps/server/internal/handlers/keys.go
---

## Decided
- Oct 24: `gateway.plan()` orders each provider's usable accounts with `accountRotation.order` (`apps/server/internal/gateway/account_strategy.go`). The strategy is stored per provider slug in the settings kv table as `provider_routing_<slug>` (`repositories.SettingRepository.ProviderRouting`). No migration was needed, it is already in config backups, and the custom-provider delete cascade removes it.
- "Router default" maps the global `provider_round_robin` / `provider_sticky_limit` settings to round robin or fill first. The user chose to keep the global default (round robin ON), so installs that never set a strategy switched from fill-first to round robin.

## Watch out
- Before this change those two Settings › Routing values were stored but never read by the gateway, which always did fill-first. Do not assume a setting is enforced just because the UI shows it: grep the gateway for the field.
- Smart round robin keys a conversation by the client's session id (`metadata.user_id`, `prompt_cache_key`), else by sha256(api key + system + first user message). `sessionKey` is computed in `handlers.go` before skills and token saving rewrite `req.System`; moving it later would change the key whenever those settings change.
- Rotation cursors and session bindings live in memory, like chain rotation. A restart rebalances.
