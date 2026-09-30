import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { SystemResources } from './types/system'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/system'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): SystemResources => {
  return {
    stats: () => {
      const url = `${path}/stats`
      return api.get(url)
    },
  }
}

export const systemServices = resources()
