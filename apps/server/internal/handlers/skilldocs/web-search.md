---
name: tera-router-web-search
description: Search the web through this Tera Router gateway with one API across Exa, Tavily, Firecrawl, Jina AI, Brave Search, and Serper.
---

# Web Search

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup.

## `POST /v1/search`

```bash
curl {{BASE_URL}}/v1/search \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{ "query": "latest Go release notes", "max_results": 5 }'
```

| Field         | Required | Notes                                                                 |
| ------------- | -------- | --------------------------------------------------------------------- |
| `query`       | yes      | The search query.                                                     |
| `max_results` | no       | 1–20, default 5.                                                      |
| `provider`    | no       | `exa`, `tavily`, `firecrawl`, `jina-ai`, `brave`, or `serper`. Omit to let the router pick. |

## Response

```json
{
  "provider": "exa",
  "query": "latest Go release notes",
  "results": [
    {
      "title": "Go 1.26 Release Notes",
      "url": "https://go.dev/doc/go1.26",
      "snippet": "…",
      "published_date": "2026-02-10"
    }
  ]
}
```

The shape is the same whichever provider answered. `published_date` is present
only when the provider reports one.

## Notes

- Without `provider`, the router tries every connected search provider in turn
  and falls back to the next when one fails.
- To read a result in full, pass its `url` to `POST /v1/web/fetch`
  ({{BASE_URL}}/skills/web-fetch/SKILL.md).
- `503` means no search provider is connected on this router.
