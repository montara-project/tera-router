import { queryOptions } from '@tanstack/react-query'

import type { UsageModelsDto, UsageProvidersDto, UsageRequestsDto } from '../dtos/query/schema'
import type { Models } from '../models'

import { services } from '../services'

export const USAGE_QUERY_KEY = 'usage'

export const TELEMETRY_USAGE_QUERY_KEY = (range?: Models.UsageRange) => {
  return [USAGE_QUERY_KEY, 'telemetry', range ?? '30d']
}

const telemetry = (range?: Models.UsageRange) =>
  queryOptions({
    queryKey: TELEMETRY_USAGE_QUERY_KEY(range),
    queryFn: async () => {
      const res = await services.usage.telemetry(range)
      // The page consumes the telemetry payload directly, so unwrap the
      // {data, metadata} envelope here.
      return res.data.data
    },
  })

export const ACTIVITY_USAGE_QUERY_KEY = () => {
  return [USAGE_QUERY_KEY, 'activity']
}

const activity = () =>
  queryOptions({
    queryKey: ACTIVITY_USAGE_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.usage.activity()
      return res.data.data
    },
  })

/** Model accounting rows the server keeps after the search, provider filter,
 * sort and paging in `params`. */
const models = (params?: UsageModelsDto) =>
  queryOptions({
    queryKey: [USAGE_QUERY_KEY, 'models', params],
    queryFn: async () => {
      const res = await services.usage.models(params)
      return res.data
    },
  })

/** One page of the provider accounting rows. */
const providers = (params?: UsageProvidersDto) =>
  queryOptions({
    queryKey: [USAGE_QUERY_KEY, 'providers', params],
    queryFn: async () => {
      const res = await services.usage.providers(params)
      return res.data
    },
  })

/** One page of the request log, searched and filtered across the whole
 * range. The metadata counts the range and its failures for the chips. */
const requests = (params?: UsageRequestsDto) =>
  queryOptions({
    queryKey: [USAGE_QUERY_KEY, 'requests', params],
    queryFn: async () => {
      const res = await services.usage.requests(params)
      return res.data
    },
  })

export const usageQueries = {
  telemetry,
  activity,
  models,
  providers,
  requests,
} as const
