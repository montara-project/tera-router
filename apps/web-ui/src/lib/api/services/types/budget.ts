import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Budget, BudgetPayload, BudgetStatus } from '../../models/budget'

export type BudgetResources = {
  list: () => Promise<AxiosListResponse<Budget>>
  status: () => Promise<AxiosListResponse<BudgetStatus>>
  store: (payload: BudgetPayload) => Promise<AxiosItemResponse<Budget>>
  update: (id: string, payload: BudgetPayload) => Promise<AxiosItemResponse<Budget>>
  remove: (id: string) => Promise<AxiosItemResponse<unknown>>
}
