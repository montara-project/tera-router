import type { AxiosItemResponse } from '@/types/api'

import type { PortalUsage } from '../../models/portal'

export type PortalResources = {
  get: (
    token: string,
    days: number,
    /** page of the request log */
    page?: { offset: number; limit: number }
  ) => Promise<AxiosItemResponse<PortalUsage>>
}
