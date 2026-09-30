import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CreateKeyDto, UpdateKeyDto } from '../../dtos/key/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { ApiKey, ApiKeyDetail } from '../../models/key'

export type KeyResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<ApiKey>>
  get: (id: string) => Promise<AxiosItemResponse<ApiKeyDetail>>
  store: (payload?: CreateKeyDto) => Promise<AxiosItemResponse<ApiKey>>
  update: (id: string, payload: UpdateKeyDto) => Promise<AxiosItemResponse<ApiKey>>
  toggleStatus: (id: string, disabled: boolean) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  reveal: (id: string) => Promise<AxiosItemResponse<{ id: string; full_key: string }>>
}
