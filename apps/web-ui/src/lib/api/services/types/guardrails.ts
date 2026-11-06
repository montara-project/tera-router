import type { AxiosDeleteResponse, AxiosItemResponse } from '@/types/api'

import type { EvaluateDto, GuardrailsSettingsDto, PolicyDto } from '../../dtos/guardrails/schema'
import type { GuardrailMetrics, GuardrailPolicy, GuardrailsOverview } from '../../models/guardrails'
import type { UsageRange } from '../../models/usage'

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
  /** the detector's action fed the decision (scoring detectors can match below threshold) */
  triggered: boolean
  action: string
  engine: string
  note?: string
  matches: GuardrailsDetectorMatch[]
}

/** Result of POST /v1/guardrails/evaluate. */
export type GuardrailsEvaluateResult = {
  decision: string
  masked_text: string
  detectors: GuardrailsDetectorResult[]
}

export type GuardrailsResources = {
  /** settings toggle + policies + the newest decisions */
  overview: () => Promise<AxiosItemResponse<GuardrailsOverview>>
  /** decision counts, actions series and breakdowns for one range */
  metrics: (range: UsageRange) => Promise<AxiosItemResponse<GuardrailMetrics>>
  store: (payload: PolicyDto) => Promise<AxiosItemResponse<GuardrailPolicy>>
  update: (id: string, payload: PolicyDto) => Promise<AxiosItemResponse<GuardrailPolicy>>
  remove: (id: string) => Promise<AxiosDeleteResponse>
  /** tenant-wide external detector engines toggle */
  updateSettings: (
    payload: GuardrailsSettingsDto
  ) => Promise<AxiosItemResponse<GuardrailsSettingsDto>>
  /** dry-run sample text against a detector config (or the merged policies) */
  evaluate: (payload: EvaluateDto) => Promise<AxiosItemResponse<GuardrailsEvaluateResult>>
}
