import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { AliasDto } from '../../dtos/alias/schema'
import type { Models } from '../../models'

export type AliasResources = {
  list: (params?: {
    search?: string
    status?: 'active' | 'inactive'
  }) => Promise<AxiosListResponse<Models.ModelAlias>>
  put: (payload: AliasDto) => Promise<AxiosItemResponse<Models.ModelAlias>>
  remove: (name: string) => Promise<AxiosDeleteResponse>
}
