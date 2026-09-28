import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { MediaResources } from './types/media'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/media'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): MediaResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
  }
}

export const mediaServices = resources()
