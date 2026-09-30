import type { ApiItemResponse } from '@/types/api'

import type { HealthWindow, ProviderHealthOverview } from '../../models/provider-health'

export type ProviderHealthResources = {
  overview: (window: HealthWindow) => Promise<ApiItemResponse<ProviderHealthOverview>>
}
