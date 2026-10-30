---
title: Repository methods hold their query directly; the web UI uses only tabler icons
author: Masb0ymas
date: 2026-10-30
branch: dev
cost: { minutes: 11, tokens: 85808 }
id: l-cb90b4ba
scope: repo
status: active
src: agent
touches:
  - ISSUES.md
  - apps/docs/content/docs/configuration.mdx
  - apps/docs/content/docs/getting-started/docker-compose.mdx
  - apps/docs/content/docs/id-ID/configuration.mdx
  - apps/docs/content/docs/id-ID/getting-started/docker-compose.mdx
  - apps/web-ui/.env.example
  - apps/web-ui/components.json
  - apps/web-ui/package.json
  - apps/web-ui/src/components/block/common/row-column-action.tsx
  - apps/web-ui/src/components/block/common/simple-alert-dialog.tsx
---

## Decided
- Oct 30: repository methods no longer forward to a same-named `xxxExec` helper. A private helper stays only when it takes an `Executor`/tx or several methods share it (e.g. `listExec` with a query argument, `UsageRepository.groupExec`). New repository methods write the query in the public method, matching the gofi 0.2.0 template.
- The web UI uses `@tabler/icons-react` only; `lucide-react` was removed and shadcn's `iconLibrary` is `tabler`, so components added by the shadcn CLI need their icons mapped to tabler (`LucideIcon` type becomes `TablerIcon`).
- better-auth and `BETTER_AUTH_*` env vars are gone; dashboard auth is the Go backend's JWT only.
- No `DirectionProvider` is mounted, so `useDirection()` was dropped; Dialog/Tooltip import from the `radix-ui` umbrella package.

## Watch out
- Files removed with `git rm` are staged immediately; a later `git add <other dir> && git commit` sweeps them into that commit. Stage deletions with the commit they belong to.
- Go functions only used by tests in other packages (`totp.Code`, `autocombo.Engine.DisableExploration`) show up in `deadcode` but must stay exported.

In the code: `apps/server/internal/repositories/*.go`; `apps/web-ui/components.json` (`"iconLibrary": "tabler"`); `apps/web-ui/src/config/env.ts`; check with `go run golang.org/x/tools/cmd/deadcode@v0.38.0 ./cmd/...`.
