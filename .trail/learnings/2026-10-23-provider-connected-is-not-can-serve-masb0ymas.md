---
title: "Provider 'connected' is not 'can serve traffic'; pickers filter on usable"
author: Masb0ymas
date: 2026-10-23
branch: dev
cost: { minutes: 3, tokens: 28834 }
id: l-5e5494f6
scope: repo
status: active
touches:
  - apps/server/internal/handlers/providers.go
---

## Decided
In the providers overview (`apps/server/internal/handlers/providers.go` Index), `connected` means the provider has any account, disabled ones included (`CountByProvider`), or has a seeded custom_providers row. It does not mean the provider can route. The gateway only uses accounts with `disabled = false AND needs_reconnect = false` (`AccountRepository.ListUsable`). So `ProviderView.Usable` (from `CountUsableByProvider`) was added, and the chain Step / model alias Fallback Order provider pickers filter `connected` by `p.usable`.

## Tried and ruled out
Filtering only on `connected` (what the chain form did before) still listed providers whose accounts were all disabled. The `CustomProvider.Enabled` column is not used for routing, so it is the wrong flag for this.

## Watch out
A server older than this change sends no `usable`, so both pickers come up empty until the server restarts.
