import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AccountResources } from './types/account'

import { ClientFetchApi } from '../client-fetch'
import {
  AccountBulkSchema,
  AccountSchema,
  AccountsExportSchema,
  AccountsImportSchema,
} from '../dtos/account/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/accounts'

const api = new ClientFetchApi({
  baseURL: String(env.API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): AccountResources => {
  return {
    list: (params) => {
      const url = path
      return api.get(url, { params })
    },
    store: (payload) => {
      const url = path
      return api.post(url, parseDto(AccountSchema, payload))
    },
    /** adds one account per pasted key (POST /v1/accounts/bulk) */
    bulkStore: (payload) => {
      const url = `${path}/bulk`
      return api.post(url, parseDto(AccountBulkSchema, payload))
    },
    get: (id) => {
      const url = `${path}/${id}`
      return api.get(url)
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.patch(url, parseDto(AccountSchema.partial(), payload))
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
    /** probes the credential against the upstream (POST /v1/accounts/:id/test) */
    test: (id) => {
      const url = `${path}/${id}/test`
      return api.post(url)
    },
    /** probes a key that is not saved yet (POST /v1/accounts/test) */
    testKey: (payload) => {
      const url = `${path}/test`
      return api.post(url, parseDto(AccountSchema, payload))
    },
    /** usage-based quota snapshot for one account */
    quota: (id) => {
      const url = `${path}/${id}/quota`
      return api.get(url)
    },
    /** one provider's accounts as a passphrase-encrypted file */
    exportByProvider: (slug, payload) => {
      const url = `/v1/providers/${encodeURIComponent(slug)}/accounts/export`
      return api.post(url, parseDto(AccountsExportSchema, payload), { responseType: 'blob' })
    },
    /** adds the accounts of an export file to the provider */
    importByProvider: (slug, payload) => {
      const url = `/v1/providers/${encodeURIComponent(slug)}/accounts/import`
      return api.post(url, parseDto(AccountsImportSchema, payload))
    },
  }
}

export const accountServices = resources()
