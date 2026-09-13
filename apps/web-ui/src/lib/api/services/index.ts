import { authServices } from './auth'
import { chainServices } from './chain'
import { quotaServices } from './quota'
import { systemServices } from './system'

export const services = {
  auth: authServices,
  chains: chainServices,
  quota: quotaServices,
  system: systemServices,
} as const
