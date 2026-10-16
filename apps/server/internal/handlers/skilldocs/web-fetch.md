---
name: tera-router-web-fetch
description: Fetch a web page as clean markdown/text through this Tera Router gateway via Exa, Tavily, Firecrawl, or Jina AI.
---

# Web Fetch

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup.

## `POST /v1/web/fetch`

```bash
curl {{BASE_URL}}/v1/web/fetch \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://go.dev/doc/effective_go" }'
```

| Field      | Required | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| `url`      | yes      | Absolute `http://` or `https://` URL.                        |
| `provider` | no       | `exa`, `tavily`, `firecrawl`, or `jina-ai`. Omit to let the router pick. |

## Response

```json
{
  "provider": "jina-ai",
  "url": "https://go.dev/doc/effective_go",
  "title": "Effective Go",
  "content": "# Effective Go\n\n…"
}
```

`content` is the page body as markdown or plain text, depending on the provider.
`title` may be empty when the provider does not report one.

## Notes

- Without `provider`, the router tries every connected fetch provider in turn and
  falls back to the next when one fails or returns an empty page.
- `400` means the URL is not an absolute http(s) URL; `503` means no fetch
  provider is connected on this router.
