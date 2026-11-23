---
title: "Next.js is only an optional peer here, so the audit override drops it instead of bumping it"
author: Masb0ymas
date: 2026-11-23
branch: dev
cost: { minutes: 2, tokens: 58245 }
id: l-43df5c04
scope: repo
status: active
src: agent
touches:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
---

## Decided
- Nov 23: `pnpm audit --prod` flagged 7 moderate Next.js advisories (<=16.4.4). No app depends on `next` directly; it was auto-installed as an optional peer of fumadocs-core, fumadocs-mdx, nuqs and glimm. Fixed with a scoped override `next@<16.4.5: ^16.4.5`, the same pattern as the other overrides.

## Tried and ruled out
- `pnpm update -r --depth Infinity next`: left next at 16.4.3.

## Watch out
- With the override, pnpm no longer installs `next` at all (lockfile loses every `next@16.4.3` entry and its peer suffixes). That is fine: main-web imports `next/*` through vinext's shims, and docs runs fumadocs on Vite. Lint, typecheck and `pnpm -r --filter '!@tera/server' build` all pass without it.
- If an app later needs real Next.js, add it as a direct dependency at >=16.4.5; don't rely on the optional-peer auto-install.

In the code: pnpm-workspace.yaml `overrides`, pnpm-lock.yaml.
