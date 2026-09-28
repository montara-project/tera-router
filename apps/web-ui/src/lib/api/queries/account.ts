import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const ACCOUNT_QUERY_KEY = 'accounts'

const list = (params?: { offset?: number; limit?: number }) =>
  queryOptions({
    queryKey: [ACCOUNT_QUERY_KEY, params],
    queryFn: async () => {
      const res = await services.accounts.list(params)
      return res.data
    },
  })

export const accountQueries = {
  list,
} as const
