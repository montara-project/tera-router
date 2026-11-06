import { z } from 'zod'

import type { HealthWindow } from '../../models/provider-health'
import type { QuotaRange } from '../../models/quota'
import type { UsageRange } from '../../models/usage'

import { enumValues } from '../enum'
import { PaginateSchema } from '../paginate'

const QUOTA_RANGES = enumValues<QuotaRange>({
  today: true,
  '24h': true,
  '7d': true,
  '30d': true,
  '90d': true,
})
const USAGE_RANGES = enumValues<UsageRange>({
  today: true,
  '24h': true,
  '7d': true,
  '30d': true,
  '90d': true,
})
const HEALTH_WINDOWS = enumValues<HealthWindow>({
  '5m': true,
  '15m': true,
  '1h': true,
  '6h': true,
  '24h': true,
  '7d': true,
  '30d': true,
  '90d': true,
})

export const QuotaRangeSchema = z.enum(QUOTA_RANGES, { error: 'The selected range is invalid.' })

/** Quota list query (GET /v1/quota). */
export const QuotaListSchema = PaginateSchema.extend({
  range: QuotaRangeSchema.optional(),
})

/** Quota overview query (GET /v1/quota/overview). */
export const QuotaOverviewSchema = z.object({
  range: QuotaRangeSchema.optional(),
})

export const UsageRangeSchema = z.enum(USAGE_RANGES, { error: 'The selected range is invalid.' })

/** Usage window query (GET /v1/usage/telemetry). */
export const UsageQuerySchema = z.object({
  range: UsageRangeSchema.optional(),
})

/** Guardrails metrics window (GET /v1/guardrails/metrics). */
export const GuardrailsMetricsQuerySchema = z.object({
  range: UsageRangeSchema.optional(),
})

export const HealthWindowSchema = z.enum(HEALTH_WINDOWS, {
  error: 'The selected window is invalid.',
})

/** Provider health window query (GET /v1/provider-health). */
export const ProviderHealthQuerySchema = z.object({
  window: HealthWindowSchema,
})

export type QuotaListDto = z.infer<typeof QuotaListSchema>
export type QuotaOverviewDto = z.infer<typeof QuotaOverviewSchema>
export type UsageQueryDto = z.infer<typeof UsageQuerySchema>
export type GuardrailsMetricsQueryDto = z.infer<typeof GuardrailsMetricsQuerySchema>
export type ProviderHealthQueryDto = z.infer<typeof ProviderHealthQuerySchema>
