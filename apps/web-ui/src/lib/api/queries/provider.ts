import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const PROVIDER_QUERY_KEY = 'providers'

const list = () =>
  queryOptions({
    queryKey: [PROVIDER_QUERY_KEY],
    queryFn: async () => {
      const res = await services.providers.list()
      return res.data
    },
  })

export const providerQueries = {
  list,
} as const
