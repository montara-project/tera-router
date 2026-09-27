import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ApiKey } from '../models/key'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/keys'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(params?: { offset?: number; limit?: number }): Promise<AxiosListResponse<ApiKey>> {
  return api.get(path, { params })
}

function store(payload?: {
  name?: string
  plan_id?: string
  scopes?: string
}): Promise<AxiosItemResponse<ApiKey>> {
  // The server requires a name; default one when the caller omits it.
  return api.post(path, { name: 'New Key', ...payload })
}

/** enable/disable a key (PATCH /v1/keys/:id) */
function toggleStatus(id: string, disabled: boolean): Promise<AxiosItemResponse<{ id: string }>> {
  return api.patch(`${path}/${id}`, { disabled })
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${path}/${id}`)
}

/** decrypts the stored key plaintext (audit-logged on the server) */
function reveal(id: string): Promise<AxiosItemResponse<{ id: string; fullKey: string }>> {
  return api.post(`${path}/${id}/reveal`)
}

export const keyServices = {
  path,
  list,
  store,
  toggleStatus,
  remove,
  reveal,
}
