import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const PLAN_QUERY_KEY = 'plans'

const list = () =>
  queryOptions({
    queryKey: [PLAN_QUERY_KEY],
    queryFn: async () => {
      const res = await services.plans.list()
      return res.data
    },
  })

export const planQueries = {
  list,
} as const
