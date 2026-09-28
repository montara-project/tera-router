import type { ApiItemResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type UsageInsights = {
  summary: Models.UsageSummary
  daily: Models.UsageDaily[]
  models: Models.UsageByModel[]
}

export type UsageResources = {
  summary: (range?: Models.UsageRange) => Promise<AxiosItemResponse<Models.UsageSummary>>
  models: (range?: Models.UsageRange) => Promise<AxiosListResponse<Models.UsageByModel>>
  insights: (range?: Models.UsageRange) => Promise<AxiosItemResponse<UsageInsights>>
  telemetry: (range?: Models.UsageRange) => Promise<ApiItemResponse<Models.UsageTelemetryOverview>>
}
