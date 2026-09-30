import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { PlanDto } from '../dtos/plan/schema'

import { services } from '../services'

export const PLAN_QUERY_KEY = 'plans'

export const LIST_PLAN_QUERY_KEY = () => {
  return [PLAN_QUERY_KEY, 'list']
}

const list = () =>
  queryOptions({
    queryKey: LIST_PLAN_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.plans.list()
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
  delete: del,
} as const
