import { type ApiItemResponse, type AxiosItemResponse } from '@/types/api'

import type { AppSettings } from '../models/settings'

const path = '/v1/settings'

/**
 * The settings endpoint is not available on the server yet, so this service
 * keeps an in-memory settings object matching what GET /v1/settings would return.
 */
let settings: AppSettings = {
  rtkEnabled: true,
  sourceCodeFilter: 'off',
  cavemanEnabled: false,
  terseEnabled: false,
  headroomEnabled: false,
  ponytailEnabled: false,
}

function get(): Promise<AxiosItemResponse<AppSettings>> {
  const body: ApiItemResponse<AppSettings> = {
    data: { ...settings },
    metadata: {},
  }

  const response = { data: body } as AxiosItemResponse<AppSettings>

  return Promise.resolve(response)
}

function update(patch: Partial<AppSettings>): Promise<AxiosItemResponse<AppSettings>> {
  settings = { ...settings, ...patch }

  const body: ApiItemResponse<AppSettings> = {
    data: { ...settings },
    metadata: {},
    message: 'Settings updated',
  }

  const response = { data: body } as AxiosItemResponse<AppSettings>

  return Promise.resolve(response)
}

export const settingsServices = {
  path,
  get,
  update,
}
