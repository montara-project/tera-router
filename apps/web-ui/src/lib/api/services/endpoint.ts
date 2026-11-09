import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { EndpointResources } from './types/endpoint'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/endpoints'

const api = new ClientFetchApi({
  baseURL: String(env.API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): EndpointResources => {
  return {
    catalog: () => {
      const url = path
      return api.get(url)
    },
  }
}

export const endpointServices = resources()
