import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const KEY_QUERY_KEY = 'keys'

const list = (params?: { offset?: number; limit?: number }) =>
  queryOptions({
    queryKey: [KEY_QUERY_KEY, 'list', params],
    queryFn: async () => {
      const res = await services.keys.list(params)
      return res.data
    },
  })

export const keyQueries = {
  list,
} as const
