import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Plan } from '../../models/plan'

export type PlanResources = {
  list: () => Promise<AxiosListResponse<Plan>>
  store: (payload?: Record<string, unknown>) => Promise<AxiosItemResponse<Plan>>
  update: (id: string, payload: Record<string, unknown>) => Promise<AxiosItemResponse<Plan>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
}
