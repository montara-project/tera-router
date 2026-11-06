import type { AxiosItemResponse } from '@/types/api'

import type { ApplyCliToolDto } from '../../dtos/cli-tool/schema'
import type { CliToolApplyResult, CliToolDetail, CliToolStatus } from '../../models/cli-tool'

export type CliToolPreviewParams = { base_url: string; model: string }

export type CliToolResources = {
  list: () => Promise<AxiosItemResponse<CliToolStatus[]>>
  get: (id: string, params: CliToolPreviewParams) => Promise<AxiosItemResponse<CliToolDetail>>
  apply: (id: string, payload: ApplyCliToolDto) => Promise<AxiosItemResponse<CliToolApplyResult>>
}
