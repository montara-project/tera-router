import { chainQueries } from './chain'
import { keyQueries } from './key'
import { mediaQueries } from './media'
import { planQueries } from './plan'
import { providerQueries } from './provider'
import { proxyPoolQueries } from './proxy-pool'
import { quotaQueries } from './quota'
import { skillQueries } from './skill'
import { systemQueries } from './system'

export const queries = {
  chains: chainQueries,
  keys: keyQueries,
  media: mediaQueries,
  plans: planQueries,
  providers: providerQueries,
  proxyPools: proxyPoolQueries,
  quota: quotaQueries,
  skills: skillQueries,
  system: systemQueries,
} as const
