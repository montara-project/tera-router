import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ChainResources } from './types/chain'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/chains'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): ChainResources => {
  return {
    list: (params) => {
      const url = path
      return api.get(url, { params })
    },
    get: (id) => {
      const url = `${path}/${id}`
      return api.get(url)
    },
    store: (payload) => {
      const url = path
      return api.post(url, payload)
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.put(url, payload)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
    /** per-chain model usage aggregation (GET /v1/chains/:id/usage) */
    usage: (id) => {
      const url = `${path}/${id}/usage`
      return api.get(url)
    },
  }
}

export const chainServices = resources()
