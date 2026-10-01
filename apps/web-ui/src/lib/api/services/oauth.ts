import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { OAuthResources } from './types/oauth'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/oauth'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): OAuthResources => {
  return {
    providers: () => {
      const url = path + '/providers'
      return api.get(url)
    },
    authorize: (provider, redirectURI) => {
      const url = `${path}/${provider}/authorize`
      return api.post(url, { redirect_uri: redirectURI })
    },
    exchange: (provider, payload) => {
      const url = `${path}/${provider}/exchange`
      return api.post(url, payload)
    },
  }
}

export const oauthServices = resources()
