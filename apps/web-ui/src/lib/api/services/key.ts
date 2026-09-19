import {
  type ApiListResponse,
  type AxiosDeleteResponse,
  type AxiosItemResponse,
  type AxiosListResponse,
} from '@/types/api'

import type { ApiKey } from '../models/key'

const path = '/v1/keys'

/**
 * The keys endpoint is not available on the server yet, so this service keeps
 * an in-memory key list matching what GET /v1/keys would return.
 */
let keys: ApiKey[] = [
  {
    id: 'key-dev',
    name: 'Dev',
    status: 'active',
    keyPreview: 'kr_qK5o...EmP8',
    fullKey: 'kr_qK5o9xTmBvLpW2nRcF8jEmP8',
    planLabel: 'Default',
    planNote: 'Plan defaults',
    createdAt: '2026-09-07',
  },
]

function list(params?: { offset?: number; limit?: number }): Promise<AxiosListResponse<ApiKey>> {
  const offset = params?.offset ?? 0
  const limit = params?.limit ?? 10

  const body: ApiListResponse<ApiKey> = {
    data: keys.slice(offset, offset + limit),
    metadata: { total: keys.length, offset, limit },
  }

  const response = { data: body } as AxiosListResponse<ApiKey>

  return Promise.resolve(response)
}

function store(payload?: { name?: string }): Promise<AxiosItemResponse<ApiKey>> {
  const raw = crypto.randomUUID().replace(/-/g, '')
  const fullKey = `kr_${raw.slice(0, 20)}`

  const key: ApiKey = {
    id: crypto.randomUUID(),
    name: payload?.name?.trim() || `Key ${keys.length + 1}`,
    status: 'active',
    keyPreview: `${fullKey.slice(0, 7)}...${fullKey.slice(-4)}`,
    fullKey,
    planLabel: 'Default',
    planNote: 'Plan defaults',
    createdAt: new Date().toISOString(),
  }

  keys = [key, ...keys]

  const response = {
    data: { data: key, metadata: {}, message: 'Key created' },
  } as AxiosItemResponse<ApiKey>

  return Promise.resolve(response)
}

function toggleStatus(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  keys = keys.map((key) =>
    key.id === id ? { ...key, status: key.status === 'active' ? 'disabled' : 'active' } : key
  )

  const response = {
    data: { data: { id }, metadata: {} },
  } as AxiosItemResponse<{ id: string }>

  return Promise.resolve(response)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  keys = keys.filter((key) => key.id !== id)

  const response = { data: { message: 'Key deleted' } } as AxiosDeleteResponse

  return Promise.resolve(response)
}

export const keyServices = {
  path,
  list,
  store,
  toggleStatus,
  remove,
}
