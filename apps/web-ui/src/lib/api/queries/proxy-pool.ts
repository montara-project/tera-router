import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ProxyPoolDto } from '../dtos/proxy-pool/schema'
import type { RelayKind } from '../models/proxy-pool'

import { services } from '../services'

export const PROXY_POOL_QUERY_KEY = 'proxy-pools'

export const LIST_PROXY_POOL_QUERY_KEY = () => {
  return [PROXY_POOL_QUERY_KEY, 'list']
}

const list = () =>
  queryOptions({
    queryKey: LIST_PROXY_POOL_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.proxyPools.list()
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ProxyPoolDto) => {
      const res = await services.proxyPools.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({ id, reqBody }: { id: string; reqBody: ProxyPoolDto }) => {
      const res = await services.proxyPools.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const bulkCreate = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (pools: ProxyPoolDto[]) => {
      const res = await services.proxyPools.bulkStore(pools)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const bulkDelete = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (ids: string[]) => {
      const res = await services.proxyPools.bulkDelete(ids)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const relayScript = () =>
  mutationOptions({
    mutationFn: async (kind: RelayKind) => {
      const res = await services.proxyPools.relayScript(kind)
      return res.data
    },
  })

const test = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.proxyPools.test(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const healthCheck = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.proxyPools.healthCheck()
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.proxyPools.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })
    },
  })
}

export const proxyPoolQueries = {
  list,
  create,
  update,
  bulkCreate,
  bulkDelete,
  relayScript,
  test,
  healthCheck,
  delete: del,
} as const
