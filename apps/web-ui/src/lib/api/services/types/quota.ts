import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { QuotaAccount, QuotaOverview, QuotaRange } from '../../models/quota'

export type QuotaListParams = { offset?: number; limit?: number; range?: QuotaRange }

export type QuotaResources = {
  list: (params?: QuotaListParams) => Promise<AxiosListResponse<QuotaAccount>>
  overview: (range?: QuotaRange) => Promise<AxiosItemResponse<QuotaOverview>>
  toggleStatus: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
}
