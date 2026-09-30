import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { SettingsResources } from './types/settings'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { SettingsSchema } from '../dtos/settings/schema'

const path = '/v1/settings'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): SettingsResources => {
  return {
    get: () => {
      const url = path
      return api.get(url)
    },
    update: (patch) => {
      const url = path
      return api.patch(url, parseDto(SettingsSchema, patch))
    },
  }
}

export const settingsServices = resources()
