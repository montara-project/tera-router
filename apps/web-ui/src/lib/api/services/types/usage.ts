import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'
import type { UsageActivity } from '../../models/usage'

export type UsageResources = {
  telemetry: (
    range?: Models.UsageRange
  ) => Promise<AxiosItemResponse<Models.UsageTelemetryOverview>>
  activity: () => Promise<AxiosItemResponse<UsageActivity>>
}
