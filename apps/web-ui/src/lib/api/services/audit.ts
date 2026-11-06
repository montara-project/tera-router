import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AuditResources } from './types/audit'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/audit'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): AuditResources => {
  return {
    list: (params) => {
      return api.get(path, { params })
    },
    stats: () => {
      return api.get(`${path}/stats`)
    },
    verify: () => {
      return api.post(`${path}/verify`)
    },
    exportJsonl: () => {
      return api.get(`${path}/export`, { responseType: 'blob' })
    },
  }
}

export const auditServices = resources()
