import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type {
  AccountBulkDto,
  AccountDto,
  AccountListDto,
  AccountsExportDto,
  AccountsImportDto,
} from '../../dtos/account/schema'
import type {
  Account,
  AccountBulkResult,
  AccountQuota,
  AccountsImportResult,
  TestResult,
} from '../../models/account'

export type AccountResources = {
  list: (params?: AccountListDto) => Promise<AxiosListResponse<Account>>
  store: (payload: AccountDto) => Promise<AxiosItemResponse<Account>>
  bulkStore: (payload: AccountBulkDto) => Promise<AxiosItemResponse<AccountBulkResult>>
  get: (id: string) => Promise<AxiosItemResponse<Account>>
  update: (id: string, payload: Partial<AccountDto>) => Promise<AxiosItemResponse<Account>>
  remove: (id: string) => Promise<AxiosItemResponse<{ id: string }>>
  test: (id: string) => Promise<AxiosItemResponse<TestResult>>
  testKey: (payload: AccountDto) => Promise<AxiosItemResponse<TestResult>>
  quota: (id: string) => Promise<AxiosItemResponse<AccountQuota>>
  exportByProvider: (slug: string, payload: AccountsExportDto) => Promise<AxiosResponse<Blob>>
  importByProvider: (
    slug: string,
    payload: AccountsImportDto
  ) => Promise<AxiosItemResponse<AccountsImportResult>>
}
