import type { AxiosItemResponse } from '@/types/api'

import type { SettingsDto } from '../../dtos/settings/schema'
import type { AppSettings, Branding } from '../../models/settings'

export type SettingsResources = {
  get: () => Promise<AxiosItemResponse<AppSettings>>
  branding: () => Promise<AxiosItemResponse<Branding>>
  update: (patch: SettingsDto) => Promise<AxiosItemResponse<AppSettings>>
}
