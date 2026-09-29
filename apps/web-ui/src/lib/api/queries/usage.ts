import { queryOptions } from '@tanstack/react-query'

import type { Models } from '../models'

import { services } from '../services'

export const USAGE_QUERY_KEY = 'usage'

export const TELEMETRY_USAGE_QUERY_KEY = (range?: Models.UsageRange) => {
  return [USAGE_QUERY_KEY, 'telemetry', range ?? '30d']
}

const telemetry = (range?: Models.UsageRange) =>
  queryOptions({
    queryKey: TELEMETRY_USAGE_QUERY_KEY(range),
    queryFn: async () => {
      const res = await services.usage.telemetry(range)
      // The page consumes the telemetry payload directly, so unwrap the
      // {data, metadata} envelope here.
      return res.data.data
    },
  })

export const usageQueries = {
  telemetry,
} as const
