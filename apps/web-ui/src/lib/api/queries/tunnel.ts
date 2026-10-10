import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

export const TUNNEL_QUERY_KEY = 'tunnels'

export const GET_CLOUDFLARE_TUNNEL_QUERY_KEY = () => {
  return [TUNNEL_QUERY_KEY, 'cloudflare']
}

const cloudflare = () =>
  queryOptions({
    queryKey: GET_CLOUDFLARE_TUNNEL_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.tunnels.cloudflare()
      return res.data.data
    },
    // cloudflared can exit on its own; poll while up so the card notices.
    refetchInterval: (query) => (query.state.data?.running ? 15_000 : false),
  })

const enableCloudflare = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.tunnels.enableCloudflare()
      return res.data
    },
    onSuccess: (res) => {
      qc.setQueryData(GET_CLOUDFLARE_TUNNEL_QUERY_KEY(), res.data)
    },
  })
}

const disableCloudflare = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.tunnels.disableCloudflare()
      return res.data
    },
    onSuccess: (res) => {
      qc.setQueryData(GET_CLOUDFLARE_TUNNEL_QUERY_KEY(), res.data)
    },
  })
}

export const tunnelQueries = {
  cloudflare,
  enableCloudflare,
  disableCloudflare,
} as const
