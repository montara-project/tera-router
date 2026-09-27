import { chainQueries } from './chain'
import { consoleQueries } from './console'
import { guardrailsQueries } from './guardrails'
import { keyQueries } from './key'
import { mediaQueries } from './media'
import { planQueries } from './plan'
import { providerQueries } from './provider'
import { providerHealthQueries } from './provider-health'
import { proxyPoolQueries } from './proxy-pool'
import { quotaQueries } from './quota'
import { settingsQueries } from './settings'
import { skillQueries } from './skill'
import { systemQueries } from './system'

export const queries = {
  chains: chainQueries,
  console: consoleQueries,
  guardrails: guardrailsQueries,
  keys: keyQueries,
  media: mediaQueries,
  plans: planQueries,
  providerHealth: providerHealthQueries,
  providers: providerQueries,
  proxyPools: proxyPoolQueries,
  quota: quotaQueries,
  settings: settingsQueries,
  skills: skillQueries,
  system: systemQueries,
} as const
