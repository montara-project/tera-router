import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AccountDto } from '../dtos/account/schema'
import type { PaginateDto } from '../dtos/paginate'

import { services } from '../services'

export const ACCOUNT_QUERY_KEY = 'accounts'

export const LIST_ACCOUNT_QUERY_KEY = (params?: PaginateDto) => {
  return [ACCOUNT_QUERY_KEY, 'list', params]
}

export const GET_ACCOUNT_QUERY_KEY = (id: string) => {
  return [ACCOUNT_QUERY_KEY, 'detail', id]
}

const list = (params?: PaginateDto) =>
  queryOptions({
    queryKey: LIST_ACCOUNT_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.accounts.list(params)
      return res.data
    },
  })

const get = (id: string) =>
  queryOptions({
    queryKey: GET_ACCOUNT_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.accounts.get(id)
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AccountDto) => {
      const res = await services.accounts.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    },
  })
}

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { id: string } & Partial<AccountDto>) => {
      const { id, ...body } = reqBody
      const res = await services.accounts.update(id, body)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.accounts.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    },
  })
}

const test = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.accounts.test(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    },
  })
}

export const accountQueries = {
  list,
  get,
  create,
  update,
  delete: del,
  test,
} as const
