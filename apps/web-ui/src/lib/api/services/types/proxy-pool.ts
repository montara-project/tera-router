import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { ProxyPool } from '../../models/proxy-pool'

export type ProxyPoolPayload = { name: string; url: string; mode?: string; label?: string }

export type ProxyPoolResources = {
  list: () => Promise<AxiosListResponse<ProxyPool>>
  store: (payload: ProxyPoolPayload) => Promise<AxiosItemResponse<ProxyPool>>
  test: (id: string) => Promise<AxiosItemResponse<ProxyPool>>
  healthCheck: () => Promise<AxiosItemResponse<{ tested: number }>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
