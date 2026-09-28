import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { PlanResources } from './types/plan'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { PlanSchema } from '../dtos/plan/schema'

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
      return api.post(url, parseDto(PlanSchema, payload ?? {}))
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.patch(url, parseDto(PlanSchema, payload))
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const planServices = resources()
