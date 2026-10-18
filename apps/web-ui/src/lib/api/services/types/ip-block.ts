import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { IPBlock } from '../../models/ip-block'

export type IPBlockPayload = { cidr: string; reason?: string }

export type IPBlockResources = {
  list: () => Promise<AxiosListResponse<IPBlock>>
  store: (payload: IPBlockPayload) => Promise<AxiosItemResponse<Pick<IPBlock, 'id' | 'cidr'>>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
