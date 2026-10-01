import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'
import { ACCOUNT_QUERY_KEY } from './account'
import { PROVIDER_QUERY_KEY } from './provider'

export const OAUTH_QUERY_KEY = 'oauth'

export const OAUTH_PROVIDERS_QUERY_KEY = () => {
  return [OAUTH_QUERY_KEY, 'providers']
}

const providers = () =>
  queryOptions({
    queryKey: OAUTH_PROVIDERS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.oauth.providers()
      return res.data
    },
  })

const exchange = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (req: { provider: string; code: string; state: string }) => {
      const res = await services.oauth.exchange(req.provider, {
        code: req.code,
        state: req.state,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
    },
  })
}

export const oauthQueries = {
  providers,
  exchange,
} as const
