import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

/** One key's usage behind its portal link; refreshed every minute. */
const get = (token: string, days: number) =>
  queryOptions({
    queryKey: ['portal', token, days],
    queryFn: async () => {
      const res = await services.portal.get(token, days)
      return res.data.data
    },
    refetchInterval: 60_000,
    // An unknown or revoked link answers 404; retrying will not change that.
    retry: false,
  })

export const portalQueries = { get } as const
