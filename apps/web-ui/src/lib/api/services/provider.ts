import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/providers'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosItemResponse<Models.ProvidersOverview>> {
  return api.get(path)
}

/** pricing snapshot (overrides + catalog fallbacks) */
function rates(): Promise<AxiosItemResponse<{ overrides: Models.PricingOverride[] }>> {
  return api.get(`${path}/rates`)
}

// Custom ([OI]-compatible) providers — server mounts these at
// /v1/custom-providers, NOT under /v1/providers.
const customPath = '/v1/custom-providers'

function customList(): Promise<AxiosListResponse<Models.CustomProvider>> {
  return api.get(customPath)
}

function customStore(
  payload: Record<string, unknown>
): Promise<AxiosItemResponse<Models.CustomProvider>> {
  return api.post(customPath, payload)
}

function customUpdate(
  id: string,
  payload: Record<string, unknown>
): Promise<AxiosItemResponse<Models.CustomProvider>> {
  return api.patch(`${customPath}/${id}`, payload)
}

function customDelete(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${customPath}/${id}`)
}

// Provider-scoped bulk account operations (provider slug as :id)
function accountsBulkDisable(slug: string): Promise<AxiosItemResponse<{ updated: number }>> {
  return api.post(`${path}/${slug}/accounts/disable-all`)
}

function accountsBulkEnable(slug: string): Promise<AxiosItemResponse<{ updated: number }>> {
  return api.post(`${path}/${slug}/accounts/enable-all`)
}

function accountsBulkDeleteDisabled(slug: string): Promise<AxiosItemResponse<{ deleted: number }>> {
  return api.delete(`${path}/${slug}/accounts/disabled`)
}

function accountsBulkDeleteAll(slug: string): Promise<AxiosItemResponse<{ deleted: number }>> {
  return api.delete(`${path}/${slug}/accounts/all`)
}

export const providerServices = {
  path,
  list,
  rates,
  customList,
  customStore,
  customUpdate,
  customDelete,
  accountsBulkDisable,
  accountsBulkEnable,
  accountsBulkDeleteDisabled,
  accountsBulkDeleteAll,
}
