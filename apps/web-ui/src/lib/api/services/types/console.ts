import type { AxiosListResponse } from '@/types/api'

import type { ConsoleLogEntry } from '../../models/console'

export type ConsoleResources = {
  get: () => Promise<AxiosListResponse<ConsoleLogEntry>>
  clear: () => Promise<AxiosListResponse<ConsoleLogEntry>>
}
