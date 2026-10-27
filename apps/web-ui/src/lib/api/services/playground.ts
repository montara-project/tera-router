import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { PlaygroundResources } from './types/playground'

import { ClientFetchApi } from '../client-fetch'
import { postEventStream } from '../sse'

const path = '/v1/playground'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

type ChatChunk = {
  choices?: { delta?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

const resources = (): PlaygroundResources => {
  return {
    models: () => {
      const url = `${path}/models`
      return api.get(url)
    },
    // The gateway answers in the OpenAI stream shape; fold it into the same
    // result the model test returns so both surfaces render it alike.
    chat: async (payload, onDelta) => {
      const url = `${path}/chat`
      const started = performance.now()
      let content = ''
      let error = ''
      let usage: ChatChunk['usage']
      const headers = await postEventStream(
        api,
        url,
        { ...payload, stream: true, stream_options: { include_usage: true } },
        (data) => {
          if (data === '[DONE]') return
          const chunk = JSON.parse(data) as ChatChunk
          if (chunk.error) {
            error = chunk.error.message || 'The model returned an error'
            return
          }
          const text = chunk.choices?.[0]?.delta?.content
          if (text) {
            content += text
            onDelta(text)
          }
          if (chunk.usage) usage = chunk.usage
        }
      )
      return {
        ok: !error && content !== '',
        status: 200,
        latency_ms: Math.round(performance.now() - started),
        // the provider the gateway routed to (its model header echoes the request)
        model: String(headers['x-terarouter-provider'] ?? ''),
        content,
        detail: error || (content ? '' : 'The model returned an empty response'),
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
      }
    },
  }
}

export const playgroundServices = resources()
