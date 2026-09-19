import {
  type ApiListResponse,
  type AxiosDeleteResponse,
  type AxiosItemResponse,
  type AxiosListResponse,
} from '@/types/api'

import type { ProxyPool } from '../models/proxy-pool'

const path = '/v1/proxy-pools'

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

/**
 * The proxy pools endpoint is not available on the server yet, so this service
 * keeps an in-memory pool list matching what GET /v1/proxy-pools would return.
 */
let pools: ProxyPool[] = [
  {
    id: 'pool-cloudflare-relay',
    name: 'cloudflare-relay',
    url: 'https://cloudflare-relay.mahdyarief.workers.dev',
    status: 'active',
    label: 'cloudflare relay',
    testedAt: hoursAgo(21 * 24),
  },
  {
    id: 'pool-localhost',
    name: 'localhost',
    url: 'http://127.0.0.1:8888/',
    status: 'active',
    testedAt: hoursAgo(6),
  },
  {
    id: 'pool-rotator',
    name: 'rotator',
    url: 'http://127.0.0.1:18080',
    status: 'active',
    mode: 'strict',
    testedAt: hoursAgo(6),
  },
]

function list(): Promise<AxiosListResponse<ProxyPool>> {
  const body: ApiListResponse<ProxyPool> = {
    data: [...pools],
    metadata: { total: pools.length },
  }

  const response = { data: body } as AxiosListResponse<ProxyPool>

  return Promise.resolve(response)
}

function store(): Promise<AxiosItemResponse<ProxyPool>> {
  const pool: ProxyPool = {
    id: crypto.randomUUID(),
    name: `pool-${pools.length + 1}`,
    url: `http://127.0.0.1:${18081 + pools.length}`,
    status: 'active',
    testedAt: new Date().toISOString(),
  }

  pools = [pool, ...pools]

  const response = {
    data: { data: pool, metadata: {}, message: 'Proxy pool created' },
  } as AxiosItemResponse<ProxyPool>

  return Promise.resolve(response)
}

function test(id: string): Promise<AxiosItemResponse<ProxyPool>> {
  pools = pools.map((pool) =>
    pool.id === id ? { ...pool, testedAt: new Date().toISOString() } : pool
  )

  const tested = pools.find((pool) => pool.id === id)!

  const response = {
    data: { data: tested, metadata: {} },
  } as AxiosItemResponse<ProxyPool>

  return Promise.resolve(response)
}

function healthCheck(): Promise<AxiosItemResponse<{ tested: number }>> {
  const testedAt = new Date().toISOString()
  pools = pools.map((pool) => ({ ...pool, testedAt }))

  const response = {
    data: { data: { tested: pools.length }, metadata: {} },
  } as AxiosItemResponse<{ tested: number }>

  return Promise.resolve(response)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  pools = pools.filter((pool) => pool.id !== id)

  const response = { data: { message: 'Proxy pool deleted' } } as AxiosDeleteResponse

  return Promise.resolve(response)
}

export const proxyPoolServices = {
  path,
  list,
  store,
  test,
  healthCheck,
  remove,
}
