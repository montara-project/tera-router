import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { OverrideResources } from './types/override'

import { ClientFetchApi } from '../client-fetch'
import { CapabilitySchema, PricingListSchema, PricingSchema } from '../dtos/override/schema'
import { parseDto } from '../dtos/parse'

const pricingPath = '/v1/model-pricing-overrides'
const capabilityPath = '/v1/capability-overrides'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): OverrideResources => {
  return {
    /** micros of a dollar per million tokens; paged and filtered server-side */
    pricingList: (params) => {
      const url = pricingPath
      return api.get(url, { params: parseDto(PricingListSchema, params ?? {}) })
    },
    pricingUpsert: (payload) => {
      const url = pricingPath
      return api.post(url, parseDto(PricingSchema, payload))
    },
    pricingDelete: (provider, model) => {
      const url = pricingPath
      return api.delete(url, { params: { provider, model } })
    },
    capabilityList: () => {
      const url = capabilityPath
      return api.get(url)
    },
    capabilityPut: (payload) => {
      const url = capabilityPath
      return api.put(url, parseDto(CapabilitySchema, payload))
    },
    capabilityDelete: (provider, model) => {
      const url = `${capabilityPath}/${provider}/${model}`
      return api.delete(url)
    },
    capabilityReset: () => {
      const url = `${capabilityPath}/reset`
      return api.post(url)
    },
  }
}

export const overrideServices = resources()
