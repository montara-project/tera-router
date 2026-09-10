import { queryOptions } from '@tanstack/react-query'

import { DEFAULT_PAGINATE } from '@/lib/constants/paginate'

import type { PaginateDto } from '../dtos/paginate'
import type { GetBaseParams } from './types/param'

import { services } from '../services'

export const CHAIN_QUERY_KEY = 'chains'

const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: [CHAIN_QUERY_KEY, params],
    queryFn: async () => {
      const pagination = {
        offset: params?.offset ?? DEFAULT_PAGINATE.offset,
        limit: params?.limit ?? DEFAULT_PAGINATE.limit,
      }

      const res = await services.chains.list(pagination)
      return res.data
    },
  })

const get = (params: GetBaseParams) =>
  queryOptions({
    queryKey: [`${CHAIN_QUERY_KEY}/id`, params.id],
    queryFn: async () => {
      const res = await services.chains.get(params.id)
      return res.data
    },
  })

export const chainQueries = {
  list,
  get,
} as const
