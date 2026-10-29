import type { AxiosItemResponse } from '@/types/api'

import type { RestrictedAccess } from '../../models/restricted-access'

export type RestrictedAccessResources = {
  get: () => Promise<AxiosItemResponse<RestrictedAccess>>
  update: (payload: RestrictedAccess) => Promise<AxiosItemResponse<RestrictedAccess>>
}
