import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Budget, BudgetPayload, BudgetStatus } from '../models/budget'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/budgets'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosListResponse<Budget>> {
  return api.get(path)
}

/** spend vs limit for every budget over its current period */
function status(): Promise<AxiosListResponse<BudgetStatus>> {
  return api.get(`${path}/status`)
}

function store(payload: BudgetPayload): Promise<AxiosItemResponse<Budget>> {
  return api.post(path, payload)
}

function update(id: string, payload: BudgetPayload): Promise<AxiosItemResponse<Budget>> {
  return api.patch(`${path}/${id}`, payload)
}

function remove(id: string): Promise<AxiosItemResponse<unknown>> {
  return api.delete(`${path}/${id}`)
}

export const budgetServices = {
  path,
  list,
  status,
  store,
  update,
  remove,
}
