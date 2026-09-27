import type { AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ConsoleLogEntry } from '../models/console'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/console'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function get(): Promise<AxiosListResponse<ConsoleLogEntry>> {
  return api.get(path)
}

function clear(): Promise<AxiosListResponse<ConsoleLogEntry>> {
  return api.delete(path)
}

export const consoleServices = {
  path,
  get,
  clear,
}
