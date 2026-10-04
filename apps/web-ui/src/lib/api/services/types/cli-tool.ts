import type { AxiosItemResponse } from '@/types/api'

import type { ApplyClaudeCodeDto } from '../../dtos/cli-tool/schema'
import type { ClaudeCodeStatus } from '../../models/cli-tool'

export type CliToolResources = {
  claudeCode: () => Promise<AxiosItemResponse<ClaudeCodeStatus>>
  applyClaudeCode: (payload: ApplyClaudeCodeDto) => Promise<AxiosItemResponse<ClaudeCodeStatus>>
}
