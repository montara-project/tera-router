import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ProxyPool } from '../models/proxy-pool'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/proxy-pools'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosListResponse<ProxyPool>> {
  return api.get(path)
}

function store(payload: {
  name: string
  url: string
  mode?: string
  label?: string
}): Promise<AxiosItemResponse<ProxyPool>> {
  return api.post(path, payload)
}

function test(id: string): Promise<AxiosItemResponse<ProxyPool>> {
  return api.post(`${path}/${id}/test`)
}

function healthCheck(): Promise<AxiosItemResponse<{ tested: number }>> {
  return api.post(`${path}/health-check`)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${path}/${id}`)
}

export const proxyPoolServices = {
  path,
  list,
  store,
  test,
  healthCheck,
  remove,
}
