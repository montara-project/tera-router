import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const PROXY_POOL_QUERY_KEY = 'proxy-pools'

const list = () =>
  queryOptions({
    queryKey: [PROXY_POOL_QUERY_KEY],
    queryFn: async () => {
      const res = await services.proxyPools.list()
      return res.data
    },
  })

export const proxyPoolQueries = {
  list,
} as const
