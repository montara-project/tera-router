import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { PaginateDto } from '../dtos/paginate'
import type { PlanDto } from '../dtos/plan/schema'

import { services } from '../services'

export const PLAN_QUERY_KEY = 'plans'

export const LIST_PLAN_QUERY_KEY = (params?: PaginateDto) => {
  return [PLAN_QUERY_KEY, 'list', params]
}

/** Every plan, or one page of them when `params` carries a limit. The
 * metadata holds the summary figures over every plan either way. */
const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_PLAN_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.plans.list(params)
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody?: PlanDto) => {
      const res = await services.plans.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: PlanDto) => {
      const res = await services.plans.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.plans.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] })
    },
  })
}

export const planQueries = {
  list,
  create,
  update,
  delete: del,
} as const
