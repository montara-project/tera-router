import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { AccountResources } from './types/account'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/accounts'
const validateKeyPath = '/v1/validate-key'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
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
      return api.post(url, payload)
    },
    /** bulk credential import (POST /v1/accounts/bulk) */
    bulk: (payload) => {
      const url = `${path}/bulk`
      return api.post(url, payload)
    },
    /** pre-save credential probe (POST /v1/validate-key) */
    validateKey: (payload) => {
      const url = validateKeyPath
      return api.post(url, payload)
    },
    get: (id) => {
      const url = `${path}/${id}`
      return api.get(url)
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.patch(url, payload)
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
    /** decrypts the stored api key plaintext (audit-logged on the server) */
    reveal: (id) => {
      const url = `${path}/${id}/reveal`
      return api.post(url)
    },
    /** usage-based quota snapshot for one account */
    quota: (id) => {
      const url = `${path}/${id}/quota`
      return api.get(url)
    },
    quotaReset: (id) => {
      const url = `${path}/${id}/quota/reset`
      return api.post(url)
    },
  }
}

export const accountServices = resources()
