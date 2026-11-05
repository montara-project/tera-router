import { accountServices } from './account'
import { aliasServices } from './alias'
import { authServices } from './auth'
import { backupServices } from './backup'
import { budgetServices } from './budget'
import { chainServices } from './chain'
import { cliToolServices } from './cli-tool'
import { consoleServices } from './console'
import { endpointServices } from './endpoint'
import { guardrailsServices } from './guardrails'
import { ipBlockServices } from './ip-block'
import { keyServices } from './key'
import { mediaServices } from './media'
import { oauthServices } from './oauth'
import { overrideServices } from './override'
import { planServices } from './plan'
import { playgroundServices } from './playground'
import { portalServices } from './portal'
import { providerServices } from './provider'
import { providerHealthServices } from './provider-health'
import { proxyPoolServices } from './proxy-pool'
import { quotaServices } from './quota'
import { restrictedAccessServices } from './restricted-access'
import { settingsServices } from './settings'
import { skillServices } from './skill'
import { systemServices } from './system'
import { tunnelServices } from './tunnel'
import { usageServices } from './usage'

export const services = {
  accounts: accountServices,
  aliases: aliasServices,
  auth: authServices,
  backup: backupServices,
  budgets: budgetServices,
  chains: chainServices,
  cliTools: cliToolServices,
  endpoints: endpointServices,
  console: consoleServices,
  guardrails: guardrailsServices,
  ipBlocks: ipBlockServices,
  restrictedAccess: restrictedAccessServices,
  keys: keyServices,
  media: mediaServices,
  oauth: oauthServices,
  overrides: overrideServices,
  plans: planServices,
  playground: playgroundServices,
  portal: portalServices,
  providerHealth: providerHealthServices,
  providers: providerServices,
  proxyPools: proxyPoolServices,
  quota: quotaServices,
  settings: settingsServices,
  skills: skillServices,
  system: systemServices,
  tunnels: tunnelServices,
  usage: usageServices,
} as const
