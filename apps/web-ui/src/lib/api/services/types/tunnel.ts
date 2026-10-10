import type { AxiosItemResponse } from '@/types/api'

import type { TunnelStatus } from '../../models/tunnel'

export type TunnelResources = {
  cloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
  enableCloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
  disableCloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
}
