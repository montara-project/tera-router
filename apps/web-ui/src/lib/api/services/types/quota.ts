import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { QuotaListDto } from '../../dtos/query/schema'
import type { QuotaAccount, QuotaOverview, QuotaRange } from '../../models/quota'

export type QuotaResources = {
  list: (params?: QuotaListDto) => Promise<AxiosListResponse<QuotaAccount>>
  overview: (range?: QuotaRange) => Promise<AxiosItemResponse<QuotaOverview>>
  toggleStatus: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
}
