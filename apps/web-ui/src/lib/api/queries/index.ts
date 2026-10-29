import { accountQueries } from './account'
import { aliasQueries } from './alias'
import { authQueries } from './auth'
import { backupQueries } from './backup'
import { budgetQueries } from './budget'
import { chainQueries } from './chain'
import { cliToolQueries } from './cli-tool'
import { consoleQueries } from './console'
import { guardrailsQueries } from './guardrails'
import { ipBlockQueries } from './ip-block'
import { keyQueries } from './key'
import { mediaQueries } from './media'
import { overrideQueries } from './override'
import { planQueries } from './plan'
import { playgroundQueries } from './playground'
import { providerQueries } from './provider'
import { providerHealthQueries } from './provider-health'
import { proxyPoolQueries } from './proxy-pool'
import { quotaQueries } from './quota'
import { restrictedAccessQueries } from './restricted-access'
import { settingsQueries } from './settings'
import { skillQueries } from './skill'
import { systemQueries } from './system'
import { tunnelQueries } from './tunnel'
import { usageQueries } from './usage'

export const queries = {
  accounts: accountQueries,
  aliases: aliasQueries,
  auth: authQueries,
  backup: backupQueries,
  budgets: budgetQueries,
  chains: chainQueries,
  cliTools: cliToolQueries,
  console: consoleQueries,
  guardrails: guardrailsQueries,
  ipBlocks: ipBlockQueries,
  restrictedAccess: restrictedAccessQueries,
  keys: keyQueries,
  media: mediaQueries,
  overrides: overrideQueries,
  plans: planQueries,
  playground: playgroundQueries,
  providerHealth: providerHealthQueries,
  providers: providerQueries,
  proxyPools: proxyPoolQueries,
  quota: quotaQueries,
  settings: settingsQueries,
  skills: skillQueries,
  system: systemQueries,
  tunnels: tunnelQueries,
  usage: usageQueries,
} as const
