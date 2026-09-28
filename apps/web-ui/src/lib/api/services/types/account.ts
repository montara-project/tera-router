import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Account, AccountPayload, TestResult } from '../../models/account'

export type AccountListParams = { offset?: number; limit?: number }

export type AccountResources = {
  list: (params?: AccountListParams) => Promise<AxiosListResponse<Account>>
  store: (payload: AccountPayload) => Promise<AxiosItemResponse<Account>>
  bulk: (payload: { accounts: AccountPayload[] }) => Promise<AxiosItemResponse<Account[]>>
  validateKey: (payload: {
    provider: string
    api_key: string
    metadata?: Record<string, unknown>
  }) => Promise<AxiosItemResponse<TestResult>>
  get: (id: string) => Promise<AxiosItemResponse<Account>>
  update: (id: string, payload: Partial<AccountPayload>) => Promise<AxiosItemResponse<Account>>
  remove: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
  test: (id: string) => Promise<AxiosItemResponse<TestResult>>
  reveal: (id: string) => Promise<AxiosItemResponse<{ id: string; api_key: string }>>
  quota: (
    id: string
  ) => Promise<
    AxiosItemResponse<{ account_id: string; quota_visibility: string; quota_note: string }>
  >
  quotaReset: (id: string) => Promise<AxiosItemResponse<unknown>>
}
