import type { ApiItemResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { Models } from '../models'

import { ClientFetchApi } from '../client-fetch'
import { USAGE_TELEMETRY_SEED } from './usage-telemetry-seed'

const path = '/v1/usage'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function summary(range?: Models.UsageRange): Promise<AxiosItemResponse<Models.UsageSummary>> {
  return api.get(path, { params: range ? { range } : undefined })
}

/** per-provider/model breakdown */
function models(range?: Models.UsageRange): Promise<AxiosListResponse<Models.UsageByModel>> {
  return api.get(`${path}/models`, { params: range ? { range } : undefined })
}

/** daily series plus summary and model ranking */
function insights(range?: Models.UsageRange): Promise<
  AxiosItemResponse<{
    summary: Models.UsageSummary
    daily: Models.UsageDaily[]
    models: Models.UsageByModel[]
  }>
> {
  return api.get(`${path}/insights`, { params: range ? { range } : undefined })
}

/**
 * Rich usage telemetry for the Usage page. TODO: the seed mirrors the
 * KeiRouter reference until the backend exposes cache/reasoning/TTFT/
 * pricing-snapshot fields; when it does, merge them from
 * `/v1/usage/summary` + `/v1/usage/insights` and drop the seed.
 */
function telemetry(
  _range?: Models.UsageRange
): Promise<ApiItemResponse<Models.UsageTelemetryOverview>> {
  return Promise.resolve({ data: USAGE_TELEMETRY_SEED, metadata: {} })
}

export const usageServices = {
  path,
  summary,
  models,
  insights,
  telemetry,
}
