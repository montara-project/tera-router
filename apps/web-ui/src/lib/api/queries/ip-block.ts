import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { IPBlockPayload } from '../services/types/ip-block'

import { services } from '../services'

export const IP_BLOCK_QUERY_KEY = 'ip-blocks'

const list = () =>
  queryOptions({
    queryKey: [IP_BLOCK_QUERY_KEY],
    queryFn: async () => {
      const res = await services.ipBlocks.list()
      return res.data
    },
    // Automatic blocks appear on their own; keep the list fresh while open.
    refetchInterval: 30_000,
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (payload: IPBlockPayload) => {
      const res = await services.ipBlocks.store(payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IP_BLOCK_QUERY_KEY] })
    },
  })
}

const remove = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.ipBlocks.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IP_BLOCK_QUERY_KEY] })
    },
  })
}

export const ipBlockQueries = {
  list,
  create,
  remove,
} as const
