import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

export const AUTH_QUERY_KEY = 'auth'

export const ME_QUERY_KEY = () => {
  return [AUTH_QUERY_KEY, 'me']
}

const me = () =>
  queryOptions({
    queryKey: ME_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.auth.profile()
      return res.data
    },
  })

const totpSetup = () =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.auth.totpSetup()
      return res.data
    },
  })

const totpEnable = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { secret: string; code: string }) => {
      const res = await services.auth.totpEnable(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY() })
    },
  })
}

const totpDisable = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { code: string }) => {
      const res = await services.auth.totpDisable(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY() })
    },
  })
}

export const authQueries = {
  me,
  totpSetup,
  totpEnable,
  totpDisable,
} as const
