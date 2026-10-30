---
title: "Rotating an API key re-authenticates like a reveal and keeps the key's identity"
author: Masb0ymas
date: 2026-10-30
branch: dev
cost: { minutes: 9, tokens: 146812 }
id: l-23780770
scope: repo
status: active
src: agent
touches:
  - apps/docs/content/docs/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/concepts/api-keys.mdx
  - apps/docs/content/docs/id-ID/api-reference/dashboard-api.mdx
  - apps/docs/content/docs/id-ID/concepts/api-keys.mdx
  - apps/server/cmd/api/routes.go
  - apps/server/internal/handlers/keys.go
  - apps/server/internal/handlers/keys_rotate_test.go
  - apps/server/internal/repositories/api_keys.go
  - apps/web-ui/src/components/block/keys/column.tsx
  - apps/web-ui/src/lib/api/queries/key.ts
---

## Decided
- Oct 30: key rotate mints a new plaintext, so it goes through `reauthenticate()` (password, then TOTP when enabled) on the server, same as reveal. Not gated only in the UI.
- Rotate swaps the credential in place: id, plan, scopes, allowed models and skills stay, so plan limits and usage history keep pointing at the same key. `last_used_at` is reset because it described the old secret.
- The web UI copies the new key to the clipboard and toasts, instead of a "show once" dialog: the new key stays sealed and recoverable through reveal, so a missed copy is not a lost key.

## Watch out
- After changing key hashes, call `KeysChanged()`: the gateway caches verified keys by lookup hash and only re-reads when the version bumps.
- A tab strip with `overflow-x-auto` whose tabs use `-mb-px` (underline overlapping the strip border) shows a vertical scrollbar, because overflow-x auto forces overflow-y auto. Add `overflow-y-hidden no-scrollbar`.

In the code: `apps/server/internal/handlers/keys.go` Rotate, `repositories/api_keys.go` Rotate, test `handlers/keys_rotate_test.go`; route `POST /v1/keys/:id/rotate`; UI `apps/web-ui/src/components/block/keys/column.tsx` ActionCell; `components/block/guardrails/guardrails-tabs.tsx`.
