import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { UsageResources } from './types/usage'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { UsageQuerySchema } from '../dtos/query/schema'

const path = '/v1/usage'

const api = new ClientFetchApi({
  baseURL: String(env.API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): UsageResources => {
  return {
    /** full Usage page payload: traffic, spend, composition, tables, requests */
    telemetry: (range) => {
      const url = `${path}/telemetry`
      return api.get(url, { params: parseDto(UsageQuerySchema, { range }) })
    },
    /** activity calendar: requests per day for the last 53 weeks, per model */
    activity: () => {
      const url = `${path}/activity`
      return api.get(url)
    },
    /** model accounting: searched, sorted and paged by the server */
    models: (params) => {
      const url = `${path}/models`
      return api.get(url, { params })
    },
    /** provider accounting, one page at a time */
    providers: (params) => {
      const url = `${path}/providers`
      return api.get(url, { params })
    },
    /** request log of the whole range: searched, filtered and paged by the server */
    requests: (params) => {
      const url = `${path}/requests`
      return api.get(url, { params })
    },
  }
}

export const usageServices = resources()
