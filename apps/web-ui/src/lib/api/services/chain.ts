import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/chains'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(params?: Record<string, unknown>): Promise<AxiosListResponse<Models.Chain>> {
  return api.get(path, { params })
}

function get(id: string): Promise<AxiosItemResponse<Models.Chain>> {
  return api.get(`${path}/${id}`)
}

function store(payload: Record<string, unknown>): Promise<AxiosItemResponse<Models.Chain>> {
  return api.post(path, payload)
}

function update(
  id: string,
  payload: Record<string, unknown>
): Promise<AxiosItemResponse<Models.Chain>> {
  return api.put(`${path}/${id}`, payload)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${path}/${id}`)
}

/** per-chain model usage aggregation (GET /v1/chains/:id/usage) */
function usage(id: string): Promise<AxiosListResponse<Models.UsageByModel>> {
  return api.get(`${path}/${id}/usage`)
}

export const chainServices = {
  path,
  list,
  get,
  store,
  update,
  remove,
  usage,
}
