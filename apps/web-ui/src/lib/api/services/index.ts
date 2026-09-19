import { authServices } from './auth'
import { chainServices } from './chain'
import { keyServices } from './key'
import { mediaServices } from './media'
import { planServices } from './plan'
import { providerServices } from './provider'
import { proxyPoolServices } from './proxy-pool'
import { quotaServices } from './quota'
import { skillServices } from './skill'
import { systemServices } from './system'

export const services = {
  auth: authServices,
  chains: chainServices,
  keys: keyServices,
  media: mediaServices,
  plans: planServices,
  providers: providerServices,
  proxyPools: proxyPoolServices,
  quota: quotaServices,
  skills: skillServices,
  system: systemServices,
} as const
