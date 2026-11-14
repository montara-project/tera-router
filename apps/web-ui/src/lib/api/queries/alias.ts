import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AliasDto } from '../dtos/alias/schema'

import { services } from '../services'

export const ALIAS_QUERY_KEY = 'model-alias'

/** Filters of GET /v1/aliases; the server applies them. */
export type AliasListDto = {
  /** Matches the alias name or its group. */
  search?: string
  status?: 'active' | 'inactive'
}

export const LIST_ALIAS_QUERY_KEY = (params?: AliasListDto) => {
  return [ALIAS_QUERY_KEY, 'list', params]
}

const list = (params?: AliasListDto) =>
  queryOptions({
    queryKey: LIST_ALIAS_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.aliases.list(params)
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
