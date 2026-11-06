import type { AxiosItemResponse } from '@/types/api'

import type { PortalUsage } from '../../models/portal'

export type PortalResources = {
  get: (token: string, days: number) => Promise<AxiosItemResponse<PortalUsage>>
}
