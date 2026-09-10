import { authServices } from './auth'
import { chainServices } from './chain'

export const services = {
  auth: authServices,
  chains: chainServices,
} as const
