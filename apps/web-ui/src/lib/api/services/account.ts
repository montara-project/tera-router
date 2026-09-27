import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Account, AccountPayload, TestResult } from '../models/account'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/accounts'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(params?: { offset?: number; limit?: number }): Promise<AxiosListResponse<Account>> {
  return api.get(path, { params })
}

function store(payload: AccountPayload): Promise<AxiosItemResponse<Account>> {
  return api.post(path, payload)
}

/** bulk credential import (POST /v1/accounts/bulk) */
function bulk(payload: { accounts: AccountPayload[] }): Promise<AxiosItemResponse<Account[]>> {
  return api.post(`${path}/bulk`, payload)
}

/** pre-save credential probe (POST /v1/validate-key) */
function validateKey(payload: {
  provider: string
  api_key: string
  metadata?: Record<string, unknown>
}): Promise<AxiosItemResponse<TestResult>> {
  return api.post('/v1/validate-key', payload)
}

function get(id: string): Promise<AxiosItemResponse<Account>> {
  return api.get(`${path}/${id}`)
}

function update(id: string, payload: Partial<AccountPayload>): Promise<AxiosItemResponse<Account>> {
  return api.patch(`${path}/${id}`, payload)
}

function remove(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  return api.delete(`${path}/${id}`)
}

/** probes the credential against the upstream (POST /v1/accounts/:id/test) */
function test(id: string): Promise<AxiosItemResponse<TestResult>> {
  return api.post(`${path}/${id}/test`)
}

/** decrypts the stored api key plaintext (audit-logged on the server) */
function reveal(id: string): Promise<AxiosItemResponse<{ id: string; api_key: string }>> {
  return api.post(`${path}/${id}/reveal`)
}

/** usage-based quota snapshot for one account */
function quota(
  id: string
): Promise<
  AxiosItemResponse<{ account_id: string; quota_visibility: string; quota_note: string }>
> {
  return api.get(`${path}/${id}/quota`)
}

function quotaReset(id: string): Promise<AxiosItemResponse<unknown>> {
  return api.post(`${path}/${id}/quota/reset`)
}

export const accountServices = {
  path,
  list,
  store,
  bulk,
  validateKey,
  get,
  update,
  remove,
  test,
  reveal,
  quota,
  quotaReset,
}
