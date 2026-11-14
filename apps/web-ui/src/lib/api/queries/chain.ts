import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ChainDto, ChainListDto } from '../dtos/chain/schema'

import { services } from '../services'

export const CHAIN_QUERY_KEY = 'chains'

export const LIST_CHAIN_QUERY_KEY = (params?: ChainListDto) => {
  return [CHAIN_QUERY_KEY, 'list', params]
}

export const GET_CHAIN_QUERY_KEY = (id: string) => {
  return [CHAIN_QUERY_KEY, 'detail', id]
}

/** Chains the server keeps after the filters in `params`: all of them, or one
 * page when `params` carries a limit. */
const list = (params?: ChainListDto) =>
  queryOptions({
    queryKey: LIST_CHAIN_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.chains.list(params)
      return res.data
    },
  })

const get = (id: string) =>
  queryOptions({
    queryKey: GET_CHAIN_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.chains.get(id)
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ChainDto) => {
      const res = await services.chains.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAIN_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ChainDto) => {
      const res = await services.chains.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAIN_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.chains.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAIN_QUERY_KEY] })
    },
  })
}

export const chainQueries = {
  list,
  get,
  create,
  update,
  delete: del,
} as const
