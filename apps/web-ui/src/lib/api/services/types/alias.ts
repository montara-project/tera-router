import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type AliasPayload = {
  name: string
  context_window?: number
  active?: boolean
  targets: { provider: string; model: string; active?: boolean }[]
}

export type AliasResources = {
  list: () => Promise<AxiosListResponse<Models.ModelAlias>>
  put: (payload: AliasPayload) => Promise<AxiosItemResponse<Models.ModelAlias>>
  remove: (name: string) => Promise<AxiosDeleteResponse>
}
