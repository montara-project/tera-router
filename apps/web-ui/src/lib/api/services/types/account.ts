import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { AccountDto, BulkAccountsDto, ValidateKeyDto } from '../../dtos/account/schema'
import type { PaginateDto } from '../../dtos/paginate'
import type { Account, TestResult } from '../../models/account'

export type AccountResources = {
  list: (params?: PaginateDto) => Promise<AxiosListResponse<Account>>
  store: (payload: AccountDto) => Promise<AxiosItemResponse<Account>>
  bulk: (payload: BulkAccountsDto) => Promise<AxiosItemResponse<Account[]>>
  validateKey: (payload: ValidateKeyDto) => Promise<AxiosItemResponse<TestResult>>
  get: (id: string) => Promise<AxiosItemResponse<Account>>
  update: (id: string, payload: Partial<AccountDto>) => Promise<AxiosItemResponse<Account>>
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
