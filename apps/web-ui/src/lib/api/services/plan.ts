import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { PlanResources } from './types/plan'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/plans'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): PlanResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
    store: (payload) => {
      const url = path
      return api.post(url, payload ?? {})
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.patch(url, payload)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const planServices = resources()
