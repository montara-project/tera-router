---
name: tera-router-image-generation
description: Generate images from text through this Tera Router gateway with the OpenAI images API, served by OpenAI or an OpenAI-compatible provider.
---

# Image Generation

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup and how `model` is resolved.

## `POST /v1/images/generations`

The body and the response are OpenAI's images API; only `model` is resolved by
the router; every other field reaches the provider unchanged.

```bash
curl {{BASE_URL}}/v1/images/generations \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{ "model": "openai/gpt-image-1", "prompt": "A watercolor fox in a snowy forest", "size": "1024x1024" }'
```

With the OpenAI SDK, set `baseURL` to `{{BASE_URL}}/v1` and call
`images.generate` as usual.

| Field    | Required | Notes                                                       |
| -------- | -------- | ----------------------------------------------------------- |
| `model`  | yes      | `provider/model`, an alias, or `chain:<name>`.               |
| `prompt` | yes      | What to draw.                                                |
| `size`, `n`, `quality`, `response_format`, … | no | Passed through as the provider defines them. |

## Response

```json
{ "created": 1760000000, "data": [{ "b64_json": "iVBORw0KGgo…" }] }
```

Depending on the model and `response_format`, each item carries `b64_json` or a
temporary `url`.

## Providers

- **OpenAI**: `openai/gpt-image-1`, `openai/dall-e-3`.
- **OpenAI-compatible custom providers**: any provider added on the dashboard
  that serves `/images/generations`, for example FLUX on a hosted endpoint:
  `<provider-slug>/<model>`.

## Notes

- Generation can take tens of seconds; the router waits up to 90 seconds.
- `400` means the model names a provider without image generation; `503` means no
  account is connected for it.
