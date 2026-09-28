import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type SystemResources = {
  stats: () => Promise<AxiosItemResponse<Models.SystemStats>>
}
