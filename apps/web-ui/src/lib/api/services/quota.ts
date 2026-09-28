import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { QuotaResources } from './types/quota'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/quota'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): QuotaResources => {
  return {
    list: (params) => {
      const url = path
      return api.get(url, { params })
    },
    overview: (range = '30d') => {
      const url = `${path}/overview`
      return api.get(url, { params: { range } })
    },
    /** toggles the account between active and paused (PATCH /v1/quota/:id) */
    toggleStatus: (id) => {
      const url = `${path}/${id}`
      return api.patch(url)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const quotaServices = resources()
