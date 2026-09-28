import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ApiKey } from '../../models/key'

export type KeyListParams = { offset?: number; limit?: number }

export type KeyPayload = { name?: string; plan_id?: string; scopes?: string }

export type KeyResources = {
  list: (params?: KeyListParams) => Promise<AxiosListResponse<ApiKey>>
  store: (payload?: KeyPayload) => Promise<AxiosItemResponse<ApiKey>>
  toggleStatus: (id: string, disabled: boolean) => Promise<AxiosItemResponse<{ id: string }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  reveal: (id: string) => Promise<AxiosItemResponse<{ id: string; fullKey: string }>>
}
