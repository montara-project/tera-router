import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type PlaygroundResources = {
  /** provider models, aliases, and chains the playground can address */
  models: () => Promise<AxiosItemResponse<Models.PlaygroundModel[]>>
  /** streamed chat routed through the gateway; resolves with the final result */
  chat: (
    payload: { model: string; messages: Models.ModelTestMessage[] },
    onDelta: (text: string) => void
  ) => Promise<Models.ModelTestResult>
}
