import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { PaginateDto } from '../dtos/paginate'
import type { QuotaRange } from '../models/quota'

import { services } from '../services'

export const QUOTA_QUERY_KEY = 'quota'

export const LIST_QUOTA_QUERY_KEY = (params?: PaginateDto) => {
  return [QUOTA_QUERY_KEY, 'list', params]
}

export const OVERVIEW_QUOTA_QUERY_KEY = (range?: QuotaRange) => {
  return [QUOTA_QUERY_KEY, 'overview', range]
}

const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_QUOTA_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.quota.list(params)
      return res.data
    },
    refetchInterval: 5000,
  })

const overview = (range: QuotaRange = '30d') =>
  queryOptions({
    queryKey: OVERVIEW_QUOTA_QUERY_KEY(range),
    queryFn: async () => {
      const res = await services.quota.overview(range)
      return res.data
    },
    refetchInterval: 5000,
  })

const toggleStatus = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.quota.toggleStatus(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.quota.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })
    },
  })
}

export const quotaQueries = {
  list,
  overview,
  toggleStatus,
  delete: del,
} as const
