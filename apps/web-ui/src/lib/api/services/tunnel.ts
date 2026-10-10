import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { TunnelResources } from './types/tunnel'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/tunnels'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): TunnelResources => {
  return {
    cloudflare: () => {
      const url = `${path}/cloudflare`
      return api.get(url)
    },
    /** spawns cloudflared on the server host (audit-logged) */
    enableCloudflare: () => {
      const url = `${path}/cloudflare/enable`
      return api.post(url)
    },
    disableCloudflare: () => {
      const url = `${path}/cloudflare/disable`
      return api.post(url)
    },
  }
}

export const tunnelServices = resources()
