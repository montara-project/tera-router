import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ReauthDto } from '../dtos/auth/schema'
import type { CreateKeyDto, KeyListDto, UpdateKeyDto } from '../dtos/key/schema'

import { services } from '../services'

export const KEY_QUERY_KEY = 'keys'

export const LIST_KEY_QUERY_KEY = (params?: KeyListDto) => {
  return [KEY_QUERY_KEY, 'list', params]
}

export const GET_KEY_QUERY_KEY = (id: string) => {
  return [KEY_QUERY_KEY, 'detail', id]
}

const list = (params?: KeyListDto) =>
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

/** Requests, tokens and spend for one key over the last 30 days. */
const usage = (id: string) =>
  queryOptions({
    queryKey: [...GET_KEY_QUERY_KEY(id), 'usage'],
    queryFn: async () => {
      const res = await services.keys.usage(id)
      return res.data.data
    },
  })

/** Guardrail decisions on one key's traffic over the last 7 days. */
const guardrailStats = (id: string) =>
  queryOptions({
    queryKey: [...GET_KEY_QUERY_KEY(id), 'guardrails'],
    queryFn: async () => {
      const res = await services.keys.guardrailStats(id)
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

const reveal = () =>
  mutationOptions({
    mutationFn: async ({ id, ...payload }: { id: string } & ReauthDto) => {
      const res = await services.keys.reveal(id, payload)
      return res.data
    },
  })

const rotate = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({ id, ...payload }: { id: string } & ReauthDto) => {
      const res = await services.keys.rotate(id, payload)
      return res.data
    },
    onSuccess: (res) => {
      if (!('totp_required' in res.data)) qc.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
    },
  })
}

/** Issues (or replaces) the key's usage-portal token; resolves with it. */
const issuePortal = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.keys.issuePortal(id)
      return res.data.data.portal_token
    },
    onSuccess: (_token, id) => qc.invalidateQueries({ queryKey: GET_KEY_QUERY_KEY(id) }),
  })
}

const revokePortal = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      await services.keys.revokePortal(id)
    },
    onSuccess: (_res, id) => qc.invalidateQueries({ queryKey: GET_KEY_QUERY_KEY(id) }),
  })
}

export const keyQueries = {
  list,
  get,
  usage,
  guardrailStats,
  create,
  update,
  delete: del,
  toggleStatus,
  reveal,
  rotate,
  issuePortal,
  revokePortal,
} as const
