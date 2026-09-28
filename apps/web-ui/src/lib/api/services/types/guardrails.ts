import type { AxiosDeleteResponse, AxiosItemResponse } from '@/types/api'

import type { GuardrailsOverview, GuardrailPolicy } from '../../models/guardrails'
import type {
  EvaluateDto,
  GuardrailsSettingsDto,
  PolicyDto,
} from '../../dtos/guardrails/schema'

/** One detector hit rendered in the dashboard test panel. */
export type GuardrailsDetectorMatch = {
  entity: string
  value: string
  start: number
  end: number
}

/** The outcome of one detector against the sample text. */
export type GuardrailsDetectorResult = {
  key: string
  label: string
  enabled: boolean
  action: string
  engine: string
  note?: string
  matches: GuardrailsDetectorMatch[]
}

/** Result of POST /v1/guardrails/evaluate. */
export type GuardrailsEvaluateResult = {
  decision: string
  maskedText: string
  detectors: GuardrailsDetectorResult[]
}

export type GuardrailsResources = {
  /** settings toggle + policies + recent guardrail audit trail */
  overview: () => Promise<ApiItemResponse<GuardrailsOverview>>
  store: (payload: PolicyDto) => Promise<ApiItemResponse<GuardrailPolicy>>
  update: (id: string, payload: PolicyDto) => Promise<ApiItemResponse<GuardrailPolicy>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  /** tenant-wide external detector engines toggle */
  updateSettings: (
    payload: GuardrailsSettingsDto
  ) => Promise<ApiItemResponse<GuardrailsSettingsDto>>
  /** dry-run sample text against a detector config (or the merged policies) */
  evaluate: (payload: EvaluateDto) => Promise<ApiItemResponse<GuardrailsEvaluateResult>>
}
