import { z } from 'zod'

import {
  optionalBoolean,
  optionalFloat,
  optionalNumber,
  optionalString,
  optionalStringArray,
  requiredString,
} from '@/lib/validation'

import type { GuardrailsScope } from '../../models/guardrails'

import { enumValues } from '../enum'

const SCOPES = enumValues<GuardrailsScope>({
  global: true,
  provider: true,
  model: true,
  chain: true,
  key: true,
})

const PiiConfigSchema = z.object({
  enabled: optionalBoolean('pii enabled'),
  entities: optionalStringArray('pii entities'),
  masking_strategy: optionalString('pii masking strategy'),
  // A detector confidence is a 0–1 ratio, so this one field is fractional
  // where the thresholds below are whole percentages.
  min_confidence: optionalFloat('pii minimum confidence'),
  engine: optionalString('pii engine'),
  scan_output: optionalBoolean('pii scan output'),
})

const InjectionConfigSchema = z.object({
  enabled: optionalBoolean('injection enabled'),
  severity: optionalString('injection severity'),
  action: optionalString('injection action'),
})

const TopicsConfigSchema = z.object({
  enabled: optionalBoolean('topics enabled'),
  mode: optionalString('topics mode'),
  topics: optionalStringArray('topics'),
  action: optionalString('topics action'),
  engine: optionalString('topics engine'),
})

const ToxicityConfigSchema = z.object({
  enabled: optionalBoolean('toxicity enabled'),
  categories: optionalStringArray('toxicity categories'),
  threshold: optionalNumber('toxicity threshold'),
  action: optionalString('toxicity action'),
  engine: optionalString('toxicity engine'),
})

const BiasConfigSchema = z.object({
  enabled: optionalBoolean('bias enabled'),
  categories: optionalStringArray('bias categories'),
  threshold: optionalNumber('bias threshold'),
  action: optionalString('bias action'),
})

/** Detector configuration document stored verbatim on the policy. */
export const GuardrailsConfigSchema = z.object({
  pii: PiiConfigSchema.optional(),
  injection: InjectionConfigSchema.optional(),
  topics: TopicsConfigSchema.optional(),
  toxicity: ToxicityConfigSchema.optional(),
  bias: BiasConfigSchema.optional(),
})

/** Guardrail policy create/update body (POST/PATCH /v1/guardrails). */
export const PolicySchema = z.object({
  name: requiredString('policy name'),
  scope: z.enum(SCOPES, { error: 'The selected policy scope is invalid.' }),
  target: optionalString('policy target'),
  protections: optionalStringArray('policy protections'),
  enabled: optionalBoolean('policy enabled'),
  config: GuardrailsConfigSchema.optional(),
})

/** Tenant-wide guardrails settings body (PUT /v1/guardrails/settings). */
export const SettingsSchema = z.object({
  external_detectors: z.boolean({ error: 'The external detectors toggle is required.' }),
})

/** Test-policy body (POST /v1/guardrails/evaluate). */
export const EvaluateSchema = z.object({
  text: requiredString('sample text'),
  config: GuardrailsConfigSchema.optional(),
})

export type PolicyDto = z.output<typeof PolicySchema>
export type GuardrailsSettingsDto = z.output<typeof SettingsSchema>
export type EvaluateDto = z.output<typeof EvaluateSchema>
