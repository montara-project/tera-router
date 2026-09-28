import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { UsageResources } from './types/usage'

import { ClientFetchApi } from '../client-fetch'
import { parseDto } from '../dtos/parse'
import { UsageQuerySchema } from '../dtos/query/schema'
import { USAGE_TELEMETRY_SEED } from './usage-telemetry-seed'

const path = '/v1/usage'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): UsageResources => {
  return {
    summary: (range) => {
      const url = path
      return api.get(url, { params: parseDto(UsageQuerySchema, { range }) })
    },
    /** per-provider/model breakdown */
    models: (range) => {
      const url = `${path}/models`
      return api.get(url, { params: parseDto(UsageQuerySchema, { range }) })
    },
    /** daily series plus summary and model ranking */
    insights: (range) => {
      const url = `${path}/insights`
      return api.get(url, { params: parseDto(UsageQuerySchema, { range }) })
    },
    /**
     * Rich usage telemetry for the Usage page. TODO: the seed mirrors the
     * KeiRouter reference until the backend exposes cache/reasoning/TTFT/
     * pricing-snapshot fields; when it does, merge them from
     * `/v1/usage/summary` + `/v1/usage/insights` and drop the seed.
     */
    telemetry: (_range) => {
      return Promise.resolve({ data: USAGE_TELEMETRY_SEED, metadata: {} })
    },
  }
}

export const usageServices = resources()
