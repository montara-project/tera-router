import type { AxiosItemResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AppSettings } from '../models/settings'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/settings'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function get(): Promise<AxiosItemResponse<AppSettings>> {
  return api.get(path)
}

function update(patch: Partial<AppSettings>): Promise<AxiosItemResponse<AppSettings>> {
  return api.patch(path, patch)
}

export const settingsServices = {
  path,
  get,
  update,
}
