import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type ProviderResources = {
  list: () => Promise<AxiosItemResponse<Models.ProvidersOverview>>
  rates: () => Promise<AxiosItemResponse<{ overrides: Models.PricingOverride[] }>>
  customList: () => Promise<AxiosListResponse<Models.CustomProvider>>
  customStore: (
    payload: Record<string, unknown>
  ) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customUpdate: (
    id: string,
    payload: Record<string, unknown>
  ) => Promise<AxiosItemResponse<Models.CustomProvider>>
  customDelete: (id: string) => Promise<AxiosDeleteResponse>
  accountsBulkDisable: (slug: string) => Promise<AxiosItemResponse<{ updated: number }>>
  accountsBulkEnable: (slug: string) => Promise<AxiosItemResponse<{ updated: number }>>
  accountsBulkDeleteDisabled: (slug: string) => Promise<AxiosItemResponse<{ deleted: number }>>
  accountsBulkDeleteAll: (slug: string) => Promise<AxiosItemResponse<{ deleted: number }>>
}
