import type { AxiosItemResponse } from '@/types/api'

import type { MediaProvider } from '../../models/media'

export type MediaResources = {
  list: () => Promise<AxiosItemResponse<{ providers: MediaProvider[] }>>
}
