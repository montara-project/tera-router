import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CustomProviderDto } from '../../dtos/provider/schema'
import type { Models } from '../../models'

export type ProviderResources = {
  list: () => Promise<AxiosItemResponse<Models.ProvidersOverview>>
  rates: () => Promise<AxiosItemResponse<{ overrides: Models.PricingOverride[] }>>
  customList: () => Promise<AxiosListResponse<Models.CustomProvider>>
  customStore: (payload: CustomProviderDto) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customUpdate: (
    id: string,
    payload: CustomProviderDto
  ) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customDelete: (id: string) => Promise<AxiosDeleteResponse>
  customModels: (
    id: string,
    params?: { search?: string; offset?: number; limit?: number }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  customModelsSync: (id: string) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  customModelsUpdate: (
    id: string,
    payload: { models: { id: string; state: Models.ProviderModelState }[] }
  ) => Promise<AxiosItemResponse<Models.UpstreamModels>>
  accountsBulkDisable: (slug: string) => Promise<AxiosItemResponse<{ updated: number }>>
  accountsBulkEnable: (slug: string) => Promise<AxiosItemResponse<{ updated: number }>>
  accountsBulkDeleteDisabled: (slug: string) => Promise<AxiosItemResponse<{ deleted: number }>>
  accountsBulkDeleteAll: (slug: string) => Promise<AxiosItemResponse<{ deleted: number }>>
}
