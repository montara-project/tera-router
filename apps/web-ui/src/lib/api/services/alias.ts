import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/models/alias'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosListResponse<Models.ModelAlias>> {
  return api.get(path)
}

/** upserts one alias pool by name (PUT semantics) */
function put(payload: {
  name: string
  context_window?: number
  active?: boolean
  targets: { provider: string; model: string; active?: boolean }[]
}): Promise<AxiosItemResponse<Models.ModelAlias>> {
  return api.put(path, payload)
}

function remove(name: string): Promise<AxiosDeleteResponse> {
  return api.delete(path, { params: { name } })
}

export const aliasServices = {
  path,
  list,
  put,
  remove,
}
