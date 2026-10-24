---
title: Provider account API keys are never returned to the client
author: Masb0ymas
date: 2026-10-24
branch: dev
cost: { minutes: 1, tokens: 42715 }
id: l-89fba28c
scope: repo
status: active
touches:
  - apps/server/cmd/api/routes.go
  - apps/server/internal/handlers/accounts.go
  - apps/web-ui/src/lib/api/services/account.ts
---

## Decided
- `POST /v1/accounts/:id/reveal` was removed (Oct 24). Provider account credentials (`account.Secret`, sealed via `app.Secrets`) are decrypted only server-side for upstream calls; no endpoint returns the plaintext. Removed from `apps/server/cmd/api/routes.go`, `apps/server/internal/handlers/accounts.go`, `apps/web-ui/src/lib/api/services/account.ts` (+ types) and the dashboard-api docs (EN + id-ID).
- Why: the web-ui never used it, and keeping it only made it possible to pull provider keys out of a stolen dashboard session.

## Watch out
- Do not re-add an account reveal/copy feature. Show masked previews only.
- `/v1/keys/:id/reveal` is different and stays: it reveals tera-router's own user API keys and is used by the Keys page and the Claude Code config block.
