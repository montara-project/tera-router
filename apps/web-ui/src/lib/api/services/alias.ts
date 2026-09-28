import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AliasResources } from './types/alias'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/models/alias'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): AliasResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
    /** upserts one alias pool by name (PUT semantics) */
    put: (payload) => {
      const url = path
      return api.put(url, payload)
    },
    remove: (name) => {
      const url = path
      return api.delete(url, { params: { name } })
    },
  }
}

export const aliasServices = resources()
