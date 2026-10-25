import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { BudgetDto } from '../dtos/budget/schema'

import { services } from '../services'

export const BUDGET_QUERY_KEY = 'budgets'

export const STATUS_BUDGET_QUERY_KEY = () => {
  return [BUDGET_QUERY_KEY, 'status']
}

/** Budgets with their current-period spend; the page only needs this view. */
const status = () =>
  queryOptions({
    queryKey: STATUS_BUDGET_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.budgets.status()
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: BudgetDto) => {
      const res = await services.budgets.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BUDGET_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: BudgetDto) => {
      const res = await services.budgets.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BUDGET_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.budgets.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BUDGET_QUERY_KEY] })
    },
  })
}

export const budgetQueries = {
  status,
  create,
  update,
  delete: del,
} as const
