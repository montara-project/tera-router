import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { CreateKeyDto, UpdateKeyDto } from '../dtos/key/schema'
import type { PaginateDto } from '../dtos/paginate'

import { services } from '../services'

export const KEY_QUERY_KEY = 'keys'

export const LIST_KEY_QUERY_KEY = (params?: PaginateDto) => {
  return [KEY_QUERY_KEY, 'list', params]
}

export const GET_KEY_QUERY_KEY = (id: string) => {
  return [KEY_QUERY_KEY, 'detail', id]
}

const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_KEY_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.keys.list(params)
      return res.data
    },
  })

const get = (id: string) =>
  queryOptions({
    queryKey: GET_KEY_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.keys.get(id)
      return res.data.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: CreateKeyDto) => {
      const res = await services.keys.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: UpdateKeyDto) => {
      const res = await services.keys.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.keys.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
    },
  })
}

const toggleStatus = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      const res = await services.keys.toggleStatus(id, disabled)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
    },
  })
}

export const keyQueries = {
  list,
  get,
  create,
  update,
  delete: del,
  toggleStatus,
} as const
