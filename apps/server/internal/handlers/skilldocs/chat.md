---
name: tera-router-chat
description: Chat and code generation through this Tera Router gateway in OpenAI or Anthropic format, with streaming.
---

# Chat

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. List usable models with
`GET /v1/models`; see {{BASE_URL}}/skills/tera-router/SKILL.md for how `model` is
resolved.

## OpenAI format — `POST /v1/chat/completions`

```bash
curl {{BASE_URL}}/v1/chat/completions \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      { "role": "system", "content": "Be brief." },
      { "role": "user", "content": "What is an LLM gateway?" }
    ]
  }'
```

With the OpenAI SDK, set `baseURL` to `{{BASE_URL}}/v1` and `apiKey` to the
`sk_tr_` key.

## Anthropic format — `POST /v1/messages`

```bash
curl {{BASE_URL}}/v1/messages \
  -H "x-api-key: sk_tr_..." \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4",
    "max_tokens": 1024,
    "messages": [{ "role": "user", "content": "Hello" }]
  }'
```

With the Anthropic SDK, set `baseURL` to `{{BASE_URL}}`.

## OpenAI Responses format — `POST /v1/responses`

Accepts the OpenAI Responses API body. `POST /responses` is the same endpoint at
the root, for clients that omit `/v1`.

## Streaming

Set `"stream": true`. The response is server-sent events in the format of the
endpoint you called, whichever provider serves the request.

## Notes

- The format you call does not have to match the provider: an Anthropic model can
  be called through `/v1/chat/completions` and the reverse.
- `X-TeraRouter-Provider` and `X-TeraRouter-Model` response headers show the
  provider and model that actually answered.
