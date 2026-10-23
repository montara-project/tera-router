---
title: "Alias rename goes through PUT previous_name, and callers of the old name break"
author: Masb0ymas
date: 2026-10-23
branch: dev
cost: { minutes: 4, tokens: 26199 }
id: l-9468a7a5
scope: repo
status: active
touches:
  - apps/server/internal/dtos/chains.go
  - apps/server/internal/handlers/chains.go
  - apps/server/internal/repositories/aliases.go
  - apps/server/internal/repositories/aliases_test.go
  - apps/web-ui/src/components/block/traffic/model-alias/alias-form-dialog.tsx
  - apps/web-ui/src/lib/api/dtos/alias/schema.ts
  - apps/web-ui/src/components/block/traffic/model-alias/alias-detail-dialog.tsx
  - apps/web-ui/src/components/block/traffic/model-alias/alias-row.tsx
  - apps/web-ui/src/routes/(protected)/(traffic)/model-alias/index.tsx
---

## Decided
Model aliases are keyed by name everywhere (gateway resolve.go GetByName, keys/plans allowed models, PUT /v1/models/alias upsert ON CONFLICT(name)). Renaming was added as an optional `previous_name` on the same PUT body rather than a new endpoint: `AliasRepository.Rename` (apps/server/internal/repositories/aliases.go) UPDATEs the name and re-runs upsertExec in one tx, keeping the stored id. 404 if previous_name is missing, 409 if the new name is taken.

## Watch out
Nothing rewrites references to the old name: clients, keys, and plans that list it stop resolving. The edit dialog (alias-form-dialog.tsx) only warns. Cascade the rename into allowed-models lists if that becomes a problem.
