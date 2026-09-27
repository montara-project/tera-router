import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Plan } from '../models/plan'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/plans'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosListResponse<Plan>> {
  return api.get(path)
}

function store(payload?: Record<string, unknown>): Promise<AxiosItemResponse<Plan>> {
  return api.post(path, payload ?? {})
}

function update(id: string, payload: Record<string, unknown>): Promise<AxiosItemResponse<Plan>> {
  return api.patch(`${path}/${id}`, payload)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${path}/${id}`)
}

export const planServices = {
  path,
  list,
  store,
  update,
  remove,
}
