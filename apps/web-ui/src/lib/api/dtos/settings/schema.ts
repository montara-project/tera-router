import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString } from '@/lib/validation'

import type { AppSettings, SourceCodeFilterMode } from '../../models/settings'

import { enumValues } from '../enum'

const SOURCE_CODE_FILTERS = enumValues<SourceCodeFilterMode>({
  off: true,
  minimal: true,
  aggressive: true,
})

/**
 * Settings patch body (PATCH /v1/settings). Every field is optional: the
 * server merges the patch over the stored document, so callers may send only
 * the keys they changed.
 */
export const SettingsSchema = z.object({
  rtkEnabled: optionalBoolean('rtk enabled'),
  sourceCodeFilter: z
    .enum(SOURCE_CODE_FILTERS, { error: 'The selected source code filter is invalid.' })
    .optional(),
  cavemanEnabled: optionalBoolean('caveman enabled'),
  terseEnabled: optionalBoolean('terse enabled'),
  headroomEnabled: optionalBoolean('headroom enabled'),
  ponytailEnabled: optionalBoolean('ponytail enabled'),
  providerRoundRobin: optionalBoolean('provider round robin'),
  providerStickyLimit: optionalNumber('provider sticky limit'),
  chainRoundRobin: optionalBoolean('chain round robin'),
  connectTimeout: optionalNumber('connect timeout'),
  streamStallTimeout: optionalNumber('stream stall timeout'),
  requestTimeout: optionalNumber('request timeout'),
  enforceRateLimits: optionalBoolean('enforce rate limits'),
  outboundProxyEnabled: optionalBoolean('outbound proxy enabled'),
  requestDetailRecording: optionalBoolean('request detail recording'),
  brandingDisplayName: optionalString('branding display name'),
  brandingTagline: optionalString('branding tagline'),
  brandingTheme: optionalString('branding theme'),
}) satisfies z.ZodType<Partial<AppSettings>>

export type SettingsDto = z.infer<typeof SettingsSchema>
