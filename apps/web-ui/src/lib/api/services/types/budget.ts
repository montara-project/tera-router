import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { BudgetDto } from '../../dtos/budget/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { Budget, BudgetStatus } from '../../models/budget'

export type BudgetResources = {
  list: () => Promise<AxiosListResponse<Budget>>
  status: (params?: PaginateDto) => Promise<AxiosListResponse<BudgetStatus>>
  store: (payload: BudgetDto) => Promise<AxiosItemResponse<Budget>>
  update: (id: string, payload: BudgetDto) => Promise<AxiosItemResponse<Budget>>
  remove: (id: string) => Promise<AxiosItemResponse<unknown>>
}
