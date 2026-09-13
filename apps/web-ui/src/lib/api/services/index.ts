import { authServices } from './auth'
import { chainServices } from './chain'
import { systemServices } from './system'

export const services = {
  auth: authServices,
  chains: chainServices,
  system: systemServices,
} as const
