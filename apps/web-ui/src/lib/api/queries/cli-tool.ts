import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ApplyCliToolDto } from '../dtos/cli-tool/schema'
import type { CliToolPreviewParams } from '../services/types/cli-tool'

import { services } from '../services'
import { KEY_QUERY_KEY } from './key'

export const CLI_TOOL_QUERY_KEY = 'cli-tools'

const list = () =>
  queryOptions({
    queryKey: [CLI_TOOL_QUERY_KEY, 'list'],
    queryFn: async () => {
      const res = await services.cliTools.list()
      return res.data.data
    },
  })

const detail = (id: string, params: CliToolPreviewParams) =>
  queryOptions({
    queryKey: [CLI_TOOL_QUERY_KEY, 'detail', id, params],
    queryFn: async () => {
      const res = await services.cliTools.get(id, params)
      return res.data.data
    },
    // Keep the preview on screen while the next endpoint or model loads.
    placeholderData: keepPreviousData,
  })

const apply = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ApplyCliToolDto) => {
      const res = await services.cliTools.apply(id, reqBody)
      return res.data
    },
    // A "create new" apply adds a key.
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] }),
  })
}

export const cliToolQueries = { list, detail, apply } as const
