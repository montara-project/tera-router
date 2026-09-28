import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { PlanDto } from '../../dtos/plan/schema'
import type { Plan } from '../../models/plan'

export type PlanResources = {
  list: () => Promise<AxiosListResponse<Plan>>
  store: (payload?: PlanDto) => Promise<AxiosItemResponse<Plan>>
  update: (id: string, payload: PlanDto) => Promise<AxiosItemResponse<Plan>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
