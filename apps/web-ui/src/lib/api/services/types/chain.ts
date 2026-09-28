import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ChainDto } from '../../dtos/chain/schema'
import type { Models } from '../../models'

export type ChainResources = {
  list: (params?: Record<string, unknown>) => Promise<AxiosListResponse<Models.Chain>>
  get: (id: string) => Promise<AxiosItemResponse<Models.Chain>>
  store: (payload: ChainDto) => Promise<AxiosItemResponse<Models.Chain>>
  update: (id: string, payload: ChainDto) => Promise<AxiosItemResponse<Models.Chain>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  usage: (id: string) => Promise<AxiosListResponse<Models.UsageByModel>>
}
