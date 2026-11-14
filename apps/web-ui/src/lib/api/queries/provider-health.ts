import { queryOptions } from '@tanstack/react-query'

import type { HealthView, HealthWindow } from '../models/provider-health'

import { services } from '../services'

export const PROVIDER_HEALTH_QUERY_KEY = 'provider-health'

export const OVERVIEW_PROVIDER_HEALTH_QUERY_KEY = (window: HealthWindow, view?: HealthView) => {
  return [PROVIDER_HEALTH_QUERY_KEY, 'overview', window, view]
}

/** The whole overview, or with `view` one table narrowed and paged by the
 * server (the counts still cover every row). */
const overview = (window: HealthWindow, view?: HealthView) =>
  queryOptions({
    queryKey: OVERVIEW_PROVIDER_HEALTH_QUERY_KEY(window, view),
    queryFn: async () => {
      const res = await services.providerHealth.overview(window, view)
      return res.data
    },
  })

export const providerHealthQueries = {
  overview,
} as const
