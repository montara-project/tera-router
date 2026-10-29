import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { RestrictedAccessResources } from './types/restricted-access'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/restricted-access'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): RestrictedAccessResources => {
  return {
    get: () => {
      return api.get(path)
    },
    update: (payload) => {
      return api.put(path, payload)
    },
  }
}

export const restrictedAccessServices = resources()
