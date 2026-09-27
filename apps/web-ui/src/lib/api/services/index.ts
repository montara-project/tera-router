import { accountServices } from './account'
import { aliasServices } from './alias'
import { authServices } from './auth'
import { budgetServices } from './budget'
import { chainServices } from './chain'
import { consoleServices } from './console'
import { keyServices } from './key'
import { mediaServices } from './media'
import { overrideServices } from './override'
import { planServices } from './plan'
import { providerServices } from './provider'
import { proxyPoolServices } from './proxy-pool'
import { quotaServices } from './quota'
import { settingsServices } from './settings'
import { skillServices } from './skill'
import { systemServices } from './system'
import { usageServices } from './usage'

export const services = {
  accounts: accountServices,
  aliases: aliasServices,
  auth: authServices,
  budgets: budgetServices,
  chains: chainServices,
  console: consoleServices,
  keys: keyServices,
  media: mediaServices,
  overrides: overrideServices,
  plans: planServices,
  providers: providerServices,
  proxyPools: proxyPoolServices,
  quota: quotaServices,
  settings: settingsServices,
  skills: skillServices,
  system: systemServices,
  usage: usageServices,
} as const
