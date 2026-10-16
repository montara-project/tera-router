---
name: tera-router-speech-to-text
description: Transcribe audio through this Tera Router gateway with the OpenAI audio API, served by OpenAI, Groq, ElevenLabs, Deepgram, or an OpenAI-compatible provider.
---

# Speech-to-Text

Base URL: `{{BASE_URL}}`. Authenticate with an `sk_tr_` API key in
`Authorization: Bearer <key>` or `x-api-key: <key>`. See
{{BASE_URL}}/skills/tera-router/SKILL.md for setup and how `model` is resolved.

## `POST /v1/audio/transcriptions`

Send `multipart/form-data`, as with OpenAI's transcription API.

```bash
curl {{BASE_URL}}/v1/audio/transcriptions \
  -H "Authorization: Bearer sk_tr_..." \
  -F file=@meeting.mp3 \
  -F model=groq/whisper-large-v3-turbo
```

With the OpenAI SDK, set `baseURL` to `{{BASE_URL}}/v1` and call
`audio.transcriptions.create` as usual.

| Field      | Required | Notes                                                    |
| ---------- | -------- | -------------------------------------------------------- |
| `file`     | yes      | The audio file, up to 25 MB.                              |
| `model`    | yes      | `provider/model`, an alias, or `chain:<name>`. See below. |
| `language` | no       | ISO-639-1 code such as `en` or `id`; improves accuracy.   |
| `prompt`   | no       | Context hint — OpenAI-compatible providers only.          |

## Response

```json
{ "text": "Hello from the meeting." }
```

The shape is the same whichever provider transcribed it.

## Models per provider

| Provider   | `model` example                    |
| ---------- | ---------------------------------- |
| OpenAI     | `openai/gpt-4o-mini-transcribe`, `openai/whisper-1` |
| Groq       | `groq/whisper-large-v3-turbo`      |
| ElevenLabs | `elevenlabs/scribe_v2`             |
| Deepgram   | `deepgram/nova-3`                  |

## Notes

- An alias or chain mixing providers falls back to the next one when a provider
  fails.
- `400` means the model names a provider without speech-to-text or the `file`
  field is missing; `503` means no account is connected for it.
