import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ProxyPoolDto } from '../../dtos/proxy-pool/schema'
import type { ProxyPool, RelayKind, RelayScript } from '../../models/proxy-pool'

export type ProxyPoolResources = {
  list: () => Promise<AxiosListResponse<ProxyPool>>
  store: (payload: ProxyPoolDto) => Promise<AxiosItemResponse<ProxyPool>>
  update: (id: string, payload: ProxyPoolDto) => Promise<AxiosItemResponse<ProxyPool>>
  bulkStore: (pools: ProxyPoolDto[]) => Promise<AxiosItemResponse<ProxyPool[]>>
  bulkDelete: (ids: string[]) => Promise<AxiosItemResponse<{ deleted: string[] }>>
  relayScript: (kind: RelayKind) => Promise<AxiosItemResponse<RelayScript>>
  test: (id: string) => Promise<AxiosItemResponse<ProxyPool>>
  healthCheck: () => Promise<AxiosItemResponse<{ tested: number }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
