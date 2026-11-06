import type { AxiosListResponse } from '@/types/api'

import type { ConsoleLogEntry } from '../../models/console'

export type ConsoleResources = {
  /** Lines newer than `after` (all of them without it); metadata carries first and session. */
  get: (after?: number) => Promise<AxiosListResponse<ConsoleLogEntry>>
  clear: () => Promise<AxiosListResponse<ConsoleLogEntry>>
}
