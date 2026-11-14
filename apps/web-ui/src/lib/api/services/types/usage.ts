import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { UsageModelsDto, UsageProvidersDto, UsageRequestsDto } from '../../dtos/query/schema'
import type { Models } from '../../models'
import type { UsageActivity } from '../../models/usage'

export type UsageResources = {
  telemetry: (
    range?: Models.UsageRange
  ) => Promise<AxiosItemResponse<Models.UsageTelemetryOverview>>
  activity: () => Promise<AxiosItemResponse<UsageActivity>>
  models: (params?: UsageModelsDto) => Promise<AxiosListResponse<Models.UsageModelAccountingRow>>
  providers: (
    params?: UsageProvidersDto
  ) => Promise<AxiosListResponse<Models.UsageProviderAccountingRow>>
  requests: (
    params?: UsageRequestsDto
  ) => Promise<AxiosListResponse<Models.UsageTerminalRequestRow>>
}
