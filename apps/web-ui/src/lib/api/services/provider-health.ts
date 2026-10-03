import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { ProviderHealthResources } from './types/provider-health'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { ProviderHealthQuerySchema } from '../dtos/query/schema'

const path = '/v1/provider-health'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): ProviderHealthResources => {
  return {
    overview: async (window) => {
      const url = path
      // Unwrap the axios layer: the resource contract (and the query) works
      // with the {data, metadata} envelope, not the raw AxiosResponse.
      const res = await api.get(url, { params: parseDto(ProviderHealthQuerySchema, { window }) })
      return res.data
    },
  }
}

export const providerHealthServices = resources()
