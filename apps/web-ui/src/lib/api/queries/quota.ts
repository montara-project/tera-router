import { queryOptions } from '@tanstack/react-query'

import type { QuotaRange } from '../models/quota'

import { services } from '../services'

export const QUOTA_QUERY_KEY = 'quota'

const overview = (range: QuotaRange = '30d') =>
  queryOptions({
    queryKey: [QUOTA_QUERY_KEY, 'overview', range],
    queryFn: async () => {
      const res = await services.quota.overview(range)
      return res.data
    },
    refetchInterval: 5000,
  })

export const quotaQueries = {
  overview,
} as const
