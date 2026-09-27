import { queryOptions } from '@tanstack/react-query'

import type { HealthWindow } from '../models/provider-health'

import { services } from '../services'

export const PROVIDER_HEALTH_QUERY_KEY = 'provider-health'

const overview = (window: HealthWindow) =>
  queryOptions({
    queryKey: [PROVIDER_HEALTH_QUERY_KEY, window],
    queryFn: async () => {
      const res = await services.providerHealth.overview(window)
      return res.data
    },
  })

export const providerHealthQueries = {
  overview,
} as const
