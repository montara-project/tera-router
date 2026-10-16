---
name: tera-router-text-to-speech
description: Turn text into speech through this Tera Router gateway with the OpenAI audio API, served by OpenAI, ElevenLabs, Deepgram, or an OpenAI-compatible provider.
---

# Text-to-Speech

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup and how `model` is resolved.

## `POST /v1/audio/speech`

The body is OpenAI's speech request; the response is the audio file itself.

```bash
curl {{BASE_URL}}/v1/audio/speech \
  -H "Authorization: Bearer sk_tr_..." \
  -H "Content-Type: application/json" \
  -d '{ "model": "openai/gpt-4o-mini-tts", "input": "Hello from Tera Router.", "voice": "alloy" }' \
  --output speech.mp3
```

With the OpenAI SDK, set `baseURL` to `{{BASE_URL}}/v1` and call
`audio.speech.create` as usual.

| Field             | Required | Notes                                                        |
| ----------------- | -------- | ------------------------------------------------------------ |
| `model`           | yes      | `provider/model`, an alias, or `chain:<name>`. See below.     |
| `input`           | yes      | The text to speak.                                            |
| `voice`           | depends  | OpenAI voice name, or an ElevenLabs voice id. Deepgram ignores it. |
| `response_format` | no       | `mp3`, `wav`, `opus`, … — honored by OpenAI-compatible providers; ElevenLabs and Deepgram return MP3. |
| `speed`           | no       | OpenAI-compatible providers only.                             |

## Models per provider

| Provider   | `model` example                       | `voice`                         |
| ---------- | ------------------------------------- | ------------------------------- |
| OpenAI     | `openai/gpt-4o-mini-tts`, `openai/tts-1` | `alloy`, `nova`, `shimmer`, …  |
| ElevenLabs | `elevenlabs/eleven_multilingual_v2`   | required: an ElevenLabs voice id |
| Deepgram   | `deepgram/aura-2-thalia-en`           | not used — the model is the voice |

## Notes

- The response `Content-Type` is the audio type (`audio/mpeg` for MP3).
- An alias or chain mixing providers falls back to the next one when a provider
  fails.
- `400` means the model names a provider without text-to-speech; `503` means no
  account is connected for it.
