import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CreateKeyDto } from '../../dtos/key/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { ApiKey } from '../../models/key'

export type KeyResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<ApiKey>>
  store: (payload?: CreateKeyDto) => Promise<AxiosItemResponse<ApiKey>>
  toggleStatus: (id: string, disabled: boolean) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  reveal: (id: string) => Promise<AxiosItemResponse<{ id: string; full_key: string }>>
}
