import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { SettingsDto } from '../dtos/settings/schema'

import { services } from '../services'

export const SETTINGS_QUERY_KEY = 'settings'

export const GET_SETTINGS_QUERY_KEY = () => {
  return [SETTINGS_QUERY_KEY, 'detail']
}

const get = () =>
  queryOptions({
    queryKey: GET_SETTINGS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.settings.get()
      return res.data
    },
  })

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: SettingsDto) => {
      const res = await services.settings.update(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] })
    },
  })
}

export const settingsQueries = {
  get,
  update,
} as const
