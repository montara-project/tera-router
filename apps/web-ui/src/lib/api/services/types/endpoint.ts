import type { AxiosItemResponse } from '@/types/api'

import type { EndpointCatalog } from '../../models/endpoint'

export type EndpointResources = {
  catalog: () => Promise<AxiosItemResponse<EndpointCatalog>>
}
