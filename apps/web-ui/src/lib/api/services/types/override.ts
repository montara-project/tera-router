import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type PricingUpsertPayload = {
  provider: string
  model: string
  input_micros: number
  output_micros: number
  cache_read_micros: number
  cache_write_micros: number
}

export type CapabilityPutPayload = {
  provider: string
  model: string
  capabilities: string[]
}

export type OverrideResources = {
  pricingList: (provider?: string) => Promise<AxiosListResponse<Models.PricingOverride>>
  pricingUpsert: (
    payload: PricingUpsertPayload
  ) => Promise<AxiosItemResponse<Models.PricingOverride>>
  pricingDelete: (provider: string, model?: string) => Promise<AxiosDeleteResponse>
  capabilityList: () => Promise<AxiosListResponse<Models.CapabilityOverride>>
  capabilityPut: (
    payload: CapabilityPutPayload
  ) => Promise<AxiosItemResponse<Models.CapabilityOverride>>
  capabilityDelete: (provider: string, model: string) => Promise<AxiosDeleteResponse>
  capabilityReset: () => Promise<AxiosItemResponse<unknown>>
}
