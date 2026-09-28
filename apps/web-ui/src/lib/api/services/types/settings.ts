import type { AxiosItemResponse } from '@/types/api'

import type { AppSettings } from '../../models/settings'

export type SettingsResources = {
  get: () => Promise<AxiosItemResponse<AppSettings>>
  update: (patch: Partial<AppSettings>) => Promise<AxiosItemResponse<AppSettings>>
}
