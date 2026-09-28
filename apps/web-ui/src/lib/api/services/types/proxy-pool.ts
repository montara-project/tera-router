import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ProxyPoolDto } from '../../dtos/proxy-pool/schema'
import type { ProxyPool } from '../../models/proxy-pool'

export type ProxyPoolResources = {
  list: () => Promise<AxiosListResponse<ProxyPool>>
  store: (payload: ProxyPoolDto) => Promise<AxiosItemResponse<ProxyPool>>
  test: (id: string) => Promise<AxiosItemResponse<ProxyPool>>
  healthCheck: () => Promise<AxiosItemResponse<{ tested: number }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
