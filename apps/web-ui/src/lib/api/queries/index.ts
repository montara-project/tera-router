import { chainQueries } from './chain'
import { quotaQueries } from './quota'
import { systemQueries } from './system'

export const queries = {
  chains: chainQueries,
  quota: quotaQueries,
  system: systemQueries,
} as const
