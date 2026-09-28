import type { AxiosItemResponse } from '@/types/api'

import type { SettingsDto } from '../../dtos/settings/schema'
import type { AppSettings } from '../../models/settings'

export type SettingsResources = {
  get: () => Promise<AxiosItemResponse<AppSettings>>
  update: (patch: SettingsDto) => Promise<AxiosItemResponse<AppSettings>>
}
