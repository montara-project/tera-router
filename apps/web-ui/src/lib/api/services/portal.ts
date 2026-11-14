import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { PortalResources } from './types/portal'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/portal'

const api = new ClientFetchApi({
  baseURL: String(env.API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): PortalResources => {
  return {
    /** public: the token is the credential, no dashboard session needed */
    get: (token, days, page) => {
      const url = `${path}/${encodeURIComponent(token)}`
      return api.get(url, { params: { days, ...page } })
    },
  }
}

export const portalServices = resources()
