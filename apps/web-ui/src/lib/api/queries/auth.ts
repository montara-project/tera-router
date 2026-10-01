import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const AUTH_QUERY_KEY = 'auth'

export const ME_QUERY_KEY = () => {
  return [AUTH_QUERY_KEY, 'me']
}

const me = () =>
  queryOptions({
    queryKey: ME_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.auth.profile()
      return res.data
    },
  })

export const authQueries = {
  me,
} as const
