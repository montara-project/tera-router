import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { RestrictedAccess } from '../models/restricted-access'

import { services } from '../services'

export const RESTRICTED_ACCESS_QUERY_KEY = 'restricted-access'

const get = () =>
  queryOptions({
    queryKey: [RESTRICTED_ACCESS_QUERY_KEY],
    queryFn: async () => {
      const res = await services.restrictedAccess.get()
      return res.data
    },
  })

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (payload: RestrictedAccess) => {
      const res = await services.restrictedAccess.update(payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RESTRICTED_ACCESS_QUERY_KEY] })
    },
  })
}

export const restrictedAccessQueries = {
  get,
  update,
} as const
