import type { AxiosItemResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/system'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function stats(): Promise<AxiosItemResponse<Models.SystemStats>> {
  return api.get(`${path}/stats`)
}

export const systemServices = {
  path,
  stats,
}
