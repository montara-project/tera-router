import { authServices } from './auth'
import { chainServices } from './chain'
import { consoleServices } from './console'
import { keyServices } from './key'
import { mediaServices } from './media'
import { planServices } from './plan'
import { providerServices } from './provider'
import { proxyPoolServices } from './proxy-pool'
import { quotaServices } from './quota'
import { settingsServices } from './settings'
import { skillServices } from './skill'
import { systemServices } from './system'

export const services = {
  auth: authServices,
  chains: chainServices,
  console: consoleServices,
  keys: keyServices,
  media: mediaServices,
  plans: planServices,
  providers: providerServices,
  proxyPools: proxyPoolServices,
  quota: quotaServices,
  settings: settingsServices,
  skills: skillServices,
  system: systemServices,
} as const
