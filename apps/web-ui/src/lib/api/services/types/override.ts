import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CapabilityDto, PricingDto } from '../../dtos/override/schema'
import type { Models } from '../../models'

export type OverrideResources = {
  pricingList: (provider?: string) => Promise<AxiosListResponse<Models.PricingOverride>>
  pricingUpsert: (payload: PricingDto) => Promise<AxiosItemResponse<Models.PricingOverride>>
  pricingDelete: (provider: string, model?: string) => Promise<AxiosDeleteResponse>
  capabilityList: () => Promise<AxiosListResponse<Models.CapabilityOverride>>
  capabilityPut: (payload: CapabilityDto) => Promise<AxiosItemResponse<Models.CapabilityOverride>>
  capabilityDelete: (provider: string, model: string) => Promise<AxiosDeleteResponse>
  capabilityReset: () => Promise<AxiosItemResponse<unknown>>
}
