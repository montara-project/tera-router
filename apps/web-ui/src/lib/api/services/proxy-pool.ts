import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ProxyPoolResources } from './types/proxy-pool'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { ProxyPoolSchema } from '../dtos/proxy-pool/schema'

const path = '/v1/proxy-pools'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): ProxyPoolResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
    store: (payload) => {
      const url = path
      return api.post(url, parseDto(ProxyPoolSchema, payload))
    },
    test: (id) => {
      const url = `${path}/${id}/test`
      return api.post(url)
    },
    healthCheck: () => {
      const url = `${path}/health-check`
      return api.post(url)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const proxyPoolServices = resources()
