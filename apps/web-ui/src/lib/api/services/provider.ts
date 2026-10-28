import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'
import type { ProviderResources } from './types/provider'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { CustomProviderSchema, ProviderRoutingSchema } from '../dtos/provider/schema'
import { postEventStream } from '../sse'

const path = '/v1/providers'

// Custom ([OI]-compatible) providers — server mounts these at
// /v1/custom-providers, NOT under /v1/providers.
const customPath = '/v1/custom-providers'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): ProviderResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
    customList: () => {
      const url = customPath
      return api.get(url)
    },
    customGet: (id) => {
      const url = `${customPath}/${id}`
      return api.get(url)
    },
    customGetBySlug: (slug) => {
      const url = `${customPath}/by-slug/${encodeURIComponent(slug)}`
      return api.get(url)
    },
    customStore: (payload) => {
      const url = customPath
      return api.post(url, parseDto(CustomProviderSchema, payload))
    },
    customUpdate: (id, payload) => {
      const url = `${customPath}/${id}`
      return api.patch(url, parseDto(CustomProviderSchema, payload))
    },
    customDelete: (id) => {
      const url = `${customPath}/${id}`
      return api.delete(url)
    },
    customBulkDelete: (ids) => {
      const url = `${customPath}/bulk-delete`
      return api.post(url, { ids })
    },
    /** stored catalog with per-model states; server-side search + paging */
    customModels: (id, params) => {
      const url = `${customPath}/${id}/models`
      return api.get(url, { params })
    },
    /** live-fetch the upstream /models list and merge it into the catalog */
    customModelsSync: (id) => {
      const url = `${customPath}/${id}/models/sync`
      return api.post(url)
    },
    customModelsUpdate: (id, payload) => {
      const url = `${customPath}/${id}/models`
      return api.patch(url, payload)
    },
    /** catalog-provider model sync (openrouter, ollama, ollama-local, cline) */
    modelsSync: (slug) => {
      const url = `${path}/${slug}/models/sync`
      return api.post(url)
    },
    /** catalog-provider stored catalog with per-model states; server-side search + paging */
    modelsList: (slug, params) => {
      const url = `${path}/${slug}/models`
      return api.get(url, { params })
    },
    modelsUpdate: (slug, payload) => {
      const url = `${path}/${slug}/models`
      return api.patch(url, payload)
    },
    /** account strategy of any provider (catalog or custom slug) */
    routing: (slug) => {
      const url = `${path}/${slug}/routing`
      return api.get(url)
    },
    updateRouting: (slug, payload) => {
      const url = `${path}/${slug}/routing`
      return api.put(url, parseDto(ProviderRoutingSchema, payload))
    },
    /** catalog-provider one-shot model test (chat completion with the stored credential) */
    modelsTest: (slug, payload) => {
      const url = `${path}/${slug}/models/test`
      return api.post(url, payload)
    },
    /** custom-provider one-shot model test */
    customModelsTest: (id, payload) => {
      const url = `${customPath}/${id}/models/test`
      return api.post(url, payload)
    },
    modelsTestStream: (slug, payload, onDelta) =>
      postModelTestStream(`${path}/${slug}/models/test`, payload, onDelta),
    customModelsTestStream: (id, payload, onDelta) =>
      postModelTestStream(`${customPath}/${id}/models/test`, payload, onDelta),
  }
}

/**
 * POST a model test with `stream: true`: each "delta" event goes to onDelta,
 * and the closing "done" event's result is returned.
 */
async function postModelTestStream(
  url: string,
  payload: { model: string; messages: Models.ModelTestMessage[] },
  onDelta: (text: string) => void
): Promise<Models.ModelTestResult> {
  let result: Models.ModelTestResult | undefined
  await postEventStream(api, url, { ...payload, stream: true }, (data) => {
    const event = JSON.parse(data) as Models.ModelTestStreamEvent
    if (event.type === 'delta') onDelta(event.text)
    else result = event.result
  })
  if (!result) throw new Error('The test stream ended before the model finished')
  return result
}

export const providerServices = resources()
