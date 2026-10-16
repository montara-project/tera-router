---
name: tera-router-embeddings
description: Create text embeddings for RAG and semantic search through this Tera Router gateway with the OpenAI embeddings API, served by OpenAI, OpenRouter, NVIDIA NIM, Cloudflare AI, Jina AI, or an OpenAI-compatible provider.
---

# Embeddings

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup and how `model` is resolved.

## `POST /v1/embeddings`

The body and the response are OpenAI's embeddings API; only `model` is resolved
by the router; every other field reaches the provider unchanged.

```bash
curl {{BASE_URL}}/v1/embeddings \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{ "model": "openai/text-embedding-3-small", "input": ["first passage", "second passage"] }'
```

With the OpenAI SDK, set `baseURL` to `{{BASE_URL}}/v1` and call
`embeddings.create` as usual.

| Field   | Required | Notes                                                        |
| ------- | -------- | ------------------------------------------------------------ |
| `model` | yes      | `provider/model`, an alias, or `chain:<name>`. See below.     |
| `input` | yes      | A string or an array of strings.                              |
| `dimensions`, `encoding_format`, `input_type`, `task`, … | no | Passed through as the provider defines them. |

## Response

```json
{
  "object": "list",
  "data": [{ "object": "embedding", "index": 0, "embedding": [0.0123, -0.0456, …] }],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 6, "total_tokens": 6 }
}
```

## Models per provider

| Provider      | `model` example                               | Notes |
| ------------- | --------------------------------------------- | ----- |
| OpenAI        | `openai/text-embedding-3-small`               | |
| OpenRouter    | `openrouter/openai/text-embedding-3-small`    | |
| NVIDIA NIM    | `nvidia/nvidia/nv-embedqa-e5-v5`              | send `"input_type": "query"` or `"passage"` |
| Cloudflare AI | `cloudflare/@cf/baai/bge-m3`                  | |
| Jina AI       | `jina-ai/jina-embeddings-v3`                  | optional `"task"`, e.g. `retrieval.query` |

## Notes

- Embed queries and documents with the same model, or the vectors are not
  comparable.
- Tokens are metered and count against the key's budgets like chat tokens.
- `400` means the model names a provider without embeddings; `503` means no
  account is connected for it.
