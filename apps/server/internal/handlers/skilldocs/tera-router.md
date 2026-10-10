---
name: tera-router
description: How to call this Tera Router gateway — base URL, authentication, model names, and the available inference endpoints.
---

# Tera Router

Tera Router is a self-hosted LLM gateway. One base URL and one API key reach every
provider configured on it. Request and response bodies are the original OpenAI and
Anthropic formats — only the base URL, the key, and the `model` value change.

## Base URL

```
{{BASE_URL}}
```

SDKs that expect an OpenAI-style base URL use `{{BASE_URL}}/v1`.

## Authentication

Send an API key that starts with `sk_tr_` (created on the dashboard's API Keys page).
Either header works:

```
Authorization: Bearer sk_tr_...
x-api-key: sk_tr_...
```

Ask the user for the key if you do not have one. Never invent one.

## Endpoints

| Endpoint                         | Format             |
| -------------------------------- | ------------------ |
| `POST /v1/chat/completions`      | OpenAI Chat        |
| `POST /v1/messages`              | Anthropic Messages |
| `POST /v1/messages/count_tokens` | Anthropic          |
| `POST /v1/responses`             | OpenAI Responses   |
| `GET /v1/models`                 | Model list         |

Only text inference is served. There are no image, audio, embedding, search, or
web-fetch endpoints.

## Model names

Call `GET /v1/models` with the API key to list what this key may use. The `model`
field accepts, in priority order:

1. `chain:<name>` — a routing chain, e.g. `chain:heavy-coding`
2. an alias name, e.g. `fast`
3. `provider/model`, e.g. `anthropic/claude-sonnet-4`
4. a plain name — looked up as a chain, then as an alias

Append a reasoning level in parentheses to request extended thinking:
`openai/gpt-4o-mini(high)`. Levels: `none`, `minimal`, `low`, `medium`, `high`,
`xhigh`, `max`, or a token budget such as `(8192)`.

## Response headers

Every response reports who served it:

```
X-TeraRouter-Provider: anthropic
X-TeraRouter-Model: claude-sonnet-4
```

## Errors

Errors use the envelope of the endpoint's format. Common statuses: `400` unknown
model, `401` missing or invalid key, `402` budget exhausted, `403` model not allowed
for this key or blocked by a guardrail.

## More

- Chat and code generation: {{BASE_URL}}/skills/chat/SKILL.md
