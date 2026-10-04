import { accountQueries } from './account'
import { aliasQueries } from './alias'
import { authQueries } from './auth'
import { backupQueries } from './backup'
import { chainQueries } from './chain'
import { consoleQueries } from './console'
import { guardrailsQueries } from './guardrails'
import { keyQueries } from './key'
import { mediaQueries } from './media'
import { overrideQueries } from './override'
import { planQueries } from './plan'
import { providerQueries } from './provider'
import { providerHealthQueries } from './provider-health'
import { proxyPoolQueries } from './proxy-pool'
import { quotaQueries } from './quota'
import { settingsQueries } from './settings'
import { skillQueries } from './skill'
import { systemQueries } from './system'
import { usageQueries } from './usage'

export const queries = {
  accounts: accountQueries,
  aliases: aliasQueries,
  auth: authQueries,
  backup: backupQueries,
  chains: chainQueries,
  console: consoleQueries,
  guardrails: guardrailsQueries,
  keys: keyQueries,
  media: mediaQueries,
  overrides: overrideQueries,
  plans: planQueries,
  providerHealth: providerHealthQueries,
  providers: providerQueries,
  proxyPools: proxyPoolQueries,
  quota: quotaQueries,
  settings: settingsQueries,
  skills: skillQueries,
  system: systemQueries,
  usage: usageQueries,
} as const
