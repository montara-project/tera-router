import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { QuotaAccount, QuotaOverview, QuotaRange } from '../models/quota'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/quota'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(params?: {
  offset?: number
  limit?: number
  range?: QuotaRange
}): Promise<AxiosListResponse<QuotaAccount>> {
  return api.get(path, { params })
}

function overview(range: QuotaRange = '30d'): Promise<AxiosItemResponse<QuotaOverview>> {
  return api.get(`${path}/overview`, { params: { range } })
}

/** toggles the account between active and paused (PATCH /v1/quota/:id) */
function toggleStatus(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  return api.patch(`${path}/${id}`)
}

function remove(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  return api.delete(`${path}/${id}`)
}

export const quotaServices = {
  path,
  list,
  overview,
  toggleStatus,
  remove,
}
