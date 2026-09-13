import { chainQueries } from './chain'
import { systemQueries } from './system'

export const queries = {
  chains: chainQueries,
  system: systemQueries,
} as const
