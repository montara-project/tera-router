import type { ApiItemResponse } from '@/types/api'

import type { HealthView, HealthWindow, ProviderHealthOverview } from '../../models/provider-health'

export type ProviderHealthResources = {
  overview: (
    window: HealthWindow,
    view?: HealthView
  ) => Promise<ApiItemResponse<ProviderHealthOverview>>
}
