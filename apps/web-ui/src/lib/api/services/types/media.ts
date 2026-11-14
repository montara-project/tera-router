import type { AxiosItemResponse } from '@/types/api'

import type { MediaCapability, MediaProvider } from '../../models/media'

export type MediaResources = {
  list: (params?: {
    /** Keeps the providers of one media kind. */
    capability?: MediaCapability
    /** Matches the provider name or slug. */
    search?: string
  }) => Promise<
    AxiosItemResponse<{
      /** Providers that match the filters. */
      providers: MediaProvider[]
      /** The matching providers with at least one account, and the rest. */
      connected: MediaProvider[]
      available: MediaProvider[]
    }>
  >
}
