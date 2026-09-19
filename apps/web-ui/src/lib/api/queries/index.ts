import { chainQueries } from './chain'
import { quotaQueries } from './quota'
import { skillQueries } from './skill'
import { systemQueries } from './system'

export const queries = {
  chains: chainQueries,
  quota: quotaQueries,
  skills: skillQueries,
  system: systemQueries,
} as const
