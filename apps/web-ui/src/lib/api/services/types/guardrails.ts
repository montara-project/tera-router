import type { ApiItemResponse } from '@/types/api'

import type { GuardrailsOverview } from '../../models/guardrails'

export type GuardrailsResources = {
  overview: () => Promise<ApiItemResponse<GuardrailsOverview>>
  updateExternalDetectors: (enabled: boolean) => Promise<ApiItemResponse<GuardrailsOverview>>
}
