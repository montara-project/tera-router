import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { IPBlockResources } from './types/ip-block'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/ip-blocks'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): IPBlockResources => {
  return {
    list: () => {
      return api.get(path)
    },
    store: (payload) => {
      return api.post(path, payload)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const ipBlockServices = resources()
