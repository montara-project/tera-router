import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'
import type { UsageActivity } from '../../models/usage'

export type UsageInsights = {
  summary: Models.UsageSummary
  daily: Models.UsageDaily[]
  models: Models.UsageByModel[]
}

export type UsageResources = {
  summary: (range?: Models.UsageRange) => Promise<AxiosItemResponse<Models.UsageSummary>>
  models: (range?: Models.UsageRange) => Promise<AxiosListResponse<Models.UsageByModel>>
  insights: (range?: Models.UsageRange) => Promise<AxiosItemResponse<UsageInsights>>
  telemetry: (
    range?: Models.UsageRange
  ) => Promise<AxiosItemResponse<Models.UsageTelemetryOverview>>
  activity: () => Promise<AxiosItemResponse<UsageActivity>>
}
