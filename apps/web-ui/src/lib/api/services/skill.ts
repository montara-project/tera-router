import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { SkillResources } from './types/skill'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/skills'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): SkillResources => {
  return {
    list: () => {
      const url = path
      return api.get(url)
    },
    store: (payload) => {
      const url = path
      return api.post(url, payload)
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
  }
}

export const skillServices = resources()
