# Tera Router

<p align="center">
  <a href="https://github.com/montara-project/tera-router/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/montara-project/tera-router?display_name=tag&sort=semver"></a>
  <a href="https://github.com/montara-project/tera-router/actions/workflows/release.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/montara-project/tera-router/release.yml?label=release"></a>
  <a href="https://github.com/montara-project/tera-router/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/montara-project/tera-router/total"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
</p>

Self-hosted AI router: one OpenAI/Anthropic-compatible gateway in front of all your providers, with
a dashboard for accounts, routing, model catalogs, and cost analytics.

> 📚 Full documentation lives at **[docs.terarouter.xyz](https://docs.terarouter.xyz)**.

## Features

- **Unified inference gateway** — `/v1/chat/completions`, `/v1/messages` (+ `count_tokens`),
  `/v1/responses`, and `/v1/models`, with per-key auth, concurrency limits, and streamed responses.
- **Routing** — chains (priority / round-robin / load-balanced) with fallback steps, model aliases
  (the public `/v1/models` surface), auto-combos (`auto`, `auto/<variant>`) built from live usage
  stats, and cross-provider fallback for bare model ids.
- **Providers** — code-defined catalog (OpenAI, Anthropic, OpenRouter, Cline, Cloudflare AI, …)
  plus arbitrary custom OpenAI/Anthropic-compatible providers. API keys and OAuth flows, upstream
  model-list sync, per-model enable/disable, and pricing import.
- **Operations** — account priorities and connection tests, quotas and budgets, proxy pools,
  rate-limit cooldowns, and self-healing exclusions for failing provider/model pairs.
- **Cost analytics** — usage telemetry, per-model/per-provider spend, pricing overrides with
  compiled-in retail fallbacks, and guardrails/skills configuration.

## Monorepo layout

| App                | Path            | Stack                                           |
| ------------------ | --------------- | ----------------------------------------------- |
| API + gateway      | `apps/server`   | Go 1.26, Fiber v3, SQLite                       |
| Admin dashboard    | `apps/web-ui`   | React, Vite, TanStack Router/Query, Tailwind v4 |
| Main web (landing) | `apps/main-web` | vinext on Cloudflare Workers                    |
| Documentation site | `apps/docs`     | Next.js (Fumadocs) → [docs.terarouter.xyz]      |

Tooling: pnpm workspaces, oxlint + oxfmt, commitlint, husky pre-commit/pre-push gates,
release-it. Container images live under `deploy/`.

## Getting started

Prerequisites: **Go 1.26+**, **Node 22+**, **pnpm**.

```sh
pnpm install

pnpm dev:server   # API + gateway on :8080 (SQLite at apps/server/terarouter.db)
pnpm dev:web      # admin dashboard (Vite)
pnpm dev:docs     # docs site on :3001
```

First run — apply migrations and seed baseline data (in `apps/server`):

```sh
make seed        # migrations + baseline data
make seed/dev    # … plus a sample API key for local testing
```

Then connect providers and create keys from the dashboard; point any OpenAI- or
Anthropic-speaking client at `http://localhost:8080/v1`.

### Useful commands

| Command                        | What it does                          |
| ------------------------------ | ------------------------------------- |
| `pnpm build`                   | Build every workspace app             |
| `pnpm lint` / `pnpm format`    | oxlint / oxfmt across the repo        |
| `make test` (in `apps/server`) | Go test suite                         |
| `make migrate/up`              | Apply pending migrations              |
| `pnpm deploy:main`             | Deploy the main-web Cloudflare Worker |

## Deployment

`deploy/docker-compose.yaml` runs the API (container built from `deploy/Dockerfile`) with a
mounted SQLite volume; `apps/main-web` deploys to Cloudflare Workers via `pnpm deploy:main`.

## Contributors

Tera Router exists thanks to everyone who has contributed.

<a href="https://github.com/montara-project/tera-router/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=montara-project/tera-router" alt="Contributors" />
</a>

## License

[MIT](LICENSE.md) © Montara Projects

[docs.terarouter.xyz]: https://docs.terarouter.xyz
