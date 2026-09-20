import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const CONSOLE_QUERY_KEY = 'console'

const get = () =>
  queryOptions({
    queryKey: [CONSOLE_QUERY_KEY],
    queryFn: async () => {
      const res = await services.console.get()
      return res.data
    },
  })

export const consoleQueries = {
  get,
} as const
