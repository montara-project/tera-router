import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const SYSTEM_QUERY_KEY = 'system'

export const STATS_SYSTEM_QUERY_KEY = () => {
  return [SYSTEM_QUERY_KEY, 'stats']
}

const stats = () =>
  queryOptions({
    queryKey: STATS_SYSTEM_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.system.stats()
      return res.data
    },
    refetchInterval: 5000,
  })

export const systemQueries = {
  stats,
} as const
