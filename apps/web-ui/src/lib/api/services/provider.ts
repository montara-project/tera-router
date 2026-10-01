import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ProviderResources } from './types/provider'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { CustomProviderSchema } from '../dtos/provider/schema'

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
    /** pricing snapshot (overrides + catalog fallbacks) */
    rates: () => {
      const url = `${path}/rates`
      return api.get(url)
    },
    customList: () => {
      const url = customPath
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
    /** provider-scoped bulk account operations (provider slug as :id) */
    accountsBulkDisable: (slug) => {
      const url = `${path}/${slug}/accounts/disable-all`
      return api.post(url)
    },
    accountsBulkEnable: (slug) => {
      const url = `${path}/${slug}/accounts/enable-all`
      return api.post(url)
    },
    accountsBulkDeleteDisabled: (slug) => {
      const url = `${path}/${slug}/accounts/disabled`
      return api.delete(url)
    },
    accountsBulkDeleteAll: (slug) => {
      const url = `${path}/${slug}/accounts/all`
      return api.delete(url)
    },
  }
}

export const providerServices = resources()
