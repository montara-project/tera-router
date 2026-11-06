import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type SystemResources = {
  stats: () => Promise<AxiosItemResponse<Models.SystemStats>>
  status: () => Promise<AxiosItemResponse<Models.SystemStatus>>
  health: () => Promise<AxiosResponse<Models.SystemHealth>>
}
