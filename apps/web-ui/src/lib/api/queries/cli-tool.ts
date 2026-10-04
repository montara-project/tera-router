import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ApplyClaudeCodeDto } from '../dtos/cli-tool/schema'

import { services } from '../services'

export const CLI_TOOL_QUERY_KEY = 'cli-tools'

export const GET_CLAUDE_CODE_QUERY_KEY = () => {
  return [CLI_TOOL_QUERY_KEY, 'claude-code']
}

const claudeCode = () =>
  queryOptions({
    queryKey: GET_CLAUDE_CODE_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.cliTools.claudeCode()
      return res.data.data
    },
  })

const applyClaudeCode = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ApplyClaudeCodeDto) => {
      const res = await services.cliTools.applyClaudeCode(reqBody)
      return res.data
    },
    onSuccess: (res) => {
      qc.setQueryData(GET_CLAUDE_CODE_QUERY_KEY(), res.data)
    },
  })
}

export const cliToolQueries = {
  claudeCode,
  applyClaudeCode,
} as const
