import type { AxiosItemResponse } from '@/types/api'

import type { ApplyClaudeCodeDto } from '../../dtos/cli-tool/schema'
import type { ClaudeCodeStatus, CliToolStatus } from '../../models/cli-tool'

export type CliToolResources = {
  list: () => Promise<AxiosItemResponse<CliToolStatus[]>>
  claudeCode: () => Promise<AxiosItemResponse<ClaudeCodeStatus>>
  applyClaudeCode: (payload: ApplyClaudeCodeDto) => Promise<AxiosItemResponse<ClaudeCodeStatus>>
}
