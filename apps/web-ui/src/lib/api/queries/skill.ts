import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const SKILL_QUERY_KEY = 'skills'

const list = () =>
  queryOptions({
    queryKey: [SKILL_QUERY_KEY],
    queryFn: async () => {
      const res = await services.skills.list()
      return res.data
    },
  })

export const skillQueries = {
  list,
} as const
