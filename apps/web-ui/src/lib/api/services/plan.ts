import {
  type ApiListResponse,
  type AxiosDeleteResponse,
  type AxiosItemResponse,
  type AxiosListResponse,
} from '@/types/api'

import type { Plan } from '../models/plan'

const path = '/v1/plans'

/**
 * The plans endpoint is not available on the server yet, so this service keeps
 * an in-memory plan list matching what GET /v1/plans would return.
 */
let plans: Plan[] = [
  {
    id: 'plan-default',
    name: 'Default',
    description: 'Default plan for existing keys',
    hardCutoff: true,
    budgetSpend: null,
    budgetTokens: null,
    rpm: null,
    tpm: null,
    concurrent: null,
    allowedModels: null,
    keysAssigned: 1,
    alertAtPercent: 80,
  },
]

function list(): Promise<AxiosListResponse<Plan>> {
  const body: ApiListResponse<Plan> = {
    data: [...plans],
    metadata: { total: plans.length },
  }

  const response = { data: body } as AxiosListResponse<Plan>

  return Promise.resolve(response)
}

function store(): Promise<AxiosItemResponse<Plan>> {
  const plan: Plan = {
    id: crypto.randomUUID(),
    name: `Plan ${plans.length + 1}`,
    description: 'Custom plan',
    hardCutoff: false,
    budgetSpend: null,
    budgetTokens: null,
    rpm: null,
    tpm: null,
    concurrent: null,
    allowedModels: null,
    keysAssigned: 0,
    alertAtPercent: 80,
  }

  plans = [plan, ...plans]

  const response = {
    data: { data: plan, metadata: {}, message: 'Plan created' },
  } as AxiosItemResponse<Plan>

  return Promise.resolve(response)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  plans = plans.filter((plan) => plan.id !== id)

  const response = { data: { message: 'Plan deleted' } } as AxiosDeleteResponse

  return Promise.resolve(response)
}

export const planServices = {
  path,
  list,
  store,
  remove,
}
