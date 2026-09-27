import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'

const pricingPath = '/v1/model-pricing-overrides'
const capabilityPath = '/v1/capability-overrides'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

// Pricing overrides (micros of a dollar per million tokens)
function pricingList(provider?: string): Promise<AxiosListResponse<Models.PricingOverride>> {
  return api.get(pricingPath, { params: provider ? { provider } : undefined })
}

function pricingUpsert(payload: {
  provider: string
  model: string
  input_micros: number
  output_micros: number
  cache_read_micros: number
  cache_write_micros: number
}): Promise<AxiosItemResponse<Models.PricingOverride>> {
  return api.post(pricingPath, payload)
}

function pricingDelete(provider: string, model?: string): Promise<AxiosDeleteResponse> {
  return api.delete(pricingPath, { params: { provider, model } })
}

// Capability overrides
function capabilityList(): Promise<AxiosListResponse<Models.CapabilityOverride>> {
  return api.get(capabilityPath)
}

function capabilityPut(payload: {
  provider: string
  model: string
  capabilities: string[]
}): Promise<AxiosItemResponse<Models.CapabilityOverride>> {
  return api.put(capabilityPath, payload)
}

function capabilityDelete(provider: string, model: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${capabilityPath}/${provider}/${model}`)
}

function capabilityReset(): Promise<AxiosItemResponse<unknown>> {
  return api.post(`${capabilityPath}/reset`)
}

export const overrideServices = {
  pricingPath,
  capabilityPath,
  pricingList,
  pricingUpsert,
  pricingDelete,
  capabilityList,
  capabilityPut,
  capabilityDelete,
  capabilityReset,
}
