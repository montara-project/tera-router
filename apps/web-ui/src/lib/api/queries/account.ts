import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type {
  AccountBulkDto,
  AccountDto,
  AccountsExportDto,
  AccountsImportDto,
} from '../dtos/account/schema'
import type { PaginateDto } from '../dtos/paginate'

import { services } from '../services'
import { decodeBlobError, fileOrTotp } from './backup'

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

export const ACCOUNT_QUOTA_QUERY_KEY = (id: string) => {
  return [ACCOUNT_QUERY_KEY, 'quota', id]
}

/** Live upstream quota windows (Claude subscription accounts). */
const quota = (id: string) =>
  queryOptions({
    queryKey: ACCOUNT_QUOTA_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.accounts.quota(id)
      return res.data
    },
  })

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

/** Checks an unsaved key against its provider; nothing is stored. */
const testKey = () =>
  mutationOptions({
    mutationFn: async (payload: AccountDto) => {
      const res = await services.accounts.testKey(payload)
      return res.data
    },
  })

/** Adds one account per pasted key; duplicates come back as skipped. */
const bulkCreate = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AccountBulkDto) => {
      const res = await services.accounts.bulkStore(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    },
  })
}

/** Downloads one provider's accounts; re-authenticated like the config export. */
const exportByProvider = (slug: string) =>
  mutationOptions({
    mutationFn: async (reqBody: AccountsExportDto) => {
      const res = await services.accounts.exportByProvider(slug, reqBody).catch(decodeBlobError)
      return fileOrTotp(res, `tera-router-${slug}-accounts`, 'json')
    },
  })

const importByProvider = (slug: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AccountsImportDto) => {
      const res = await services.accounts.importByProvider(slug, reqBody)
      return res.data
    },
    onSuccess: () => {
      // A first import also seeds the provider row, so providers refetch too.
      qc.invalidateQueries()
    },
  })
}

export const accountQueries = {
  list,
  get,
  create,
  bulkCreate,
  exportByProvider,
  importByProvider,
  update,
  delete: del,
  test,
  testKey,
  quota,
} as const
