import { authServices } from './auth'
import { chainServices } from './chain'
import { quotaServices } from './quota'
import { skillServices } from './skill'
import { systemServices } from './system'

export const services = {
  auth: authServices,
  chains: chainServices,
  quota: quotaServices,
  skills: skillServices,
  system: systemServices,
} as const
