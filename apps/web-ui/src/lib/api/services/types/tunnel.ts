import type { AxiosItemResponse } from '@/types/api'

import type { TailscaleStatus, TunnelStatus } from '../../models/tunnel'

export type TunnelResources = {
  cloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
  enableCloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
  disableCloudflare: () => Promise<AxiosItemResponse<TunnelStatus>>
  tailscale: () => Promise<AxiosItemResponse<TailscaleStatus>>
  enableTailscale: () => Promise<AxiosItemResponse<TailscaleStatus>>
  disableTailscale: () => Promise<AxiosItemResponse<TailscaleStatus>>
}
