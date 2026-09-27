import type { AxiosItemResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { MediaProvider } from '../models/media'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/media'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosItemResponse<{ providers: MediaProvider[] }>> {
  return api.get(path)
}

export const mediaServices = {
  path,
  list,
}
