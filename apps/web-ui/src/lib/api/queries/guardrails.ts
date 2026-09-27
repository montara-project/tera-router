import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const GUARDRAILS_QUERY_KEY = 'guardrails'

const overview = () =>
  queryOptions({
    queryKey: [GUARDRAILS_QUERY_KEY],
    queryFn: async () => {
      const res = await services.guardrails.overview()
      return res.data
    },
  })

export const guardrailsQueries = {
  overview,
} as const
