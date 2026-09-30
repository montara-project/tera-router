import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AliasDto } from '../dtos/alias/schema'

import { services } from '../services'

export const ALIAS_QUERY_KEY = 'model-alias'

export const LIST_ALIAS_QUERY_KEY = () => {
  return [ALIAS_QUERY_KEY, 'list']
}

const list = () =>
  queryOptions({
    queryKey: LIST_ALIAS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.aliases.list()
      return res.data
    },
  })

/** Upsert replaces the whole pool (name, targets, active) server-side. */
const upsert = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AliasDto) => {
      const res = await services.aliases.put(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ALIAS_QUERY_KEY] })
    },
  })
}

const remove = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (name: string) => {
      const res = await services.aliases.remove(name)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ALIAS_QUERY_KEY] })
    },
  })
}

export const aliasQueries = {
  list,
  upsert,
  remove,
} as const
