import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const SYSTEM_QUERY_KEY = 'system'

const stats = () =>
  queryOptions({
    queryKey: [SYSTEM_QUERY_KEY, 'stats'],
    queryFn: async () => {
      const res = await services.system.stats()
      return res.data
    },
    refetchInterval: 5000,
  })

export const systemQueries = {
  stats,
} as const
