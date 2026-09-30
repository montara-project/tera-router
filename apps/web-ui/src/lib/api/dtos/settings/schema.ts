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
  rtk_enabled: optionalBoolean('rtk enabled'),
  source_code_filter: z
    .enum(SOURCE_CODE_FILTERS, { error: 'The selected source code filter is invalid.' })
    .optional(),
  caveman_enabled: optionalBoolean('caveman enabled'),
  terse_enabled: optionalBoolean('terse enabled'),
  headroom_enabled: optionalBoolean('headroom enabled'),
  ponytail_enabled: optionalBoolean('ponytail enabled'),
  provider_round_robin: optionalBoolean('provider round robin'),
  provider_sticky_limit: optionalNumber('provider sticky limit'),
  chain_round_robin: optionalBoolean('chain round robin'),
  connect_timeout: optionalNumber('connect timeout'),
  stream_stall_timeout: optionalNumber('stream stall timeout'),
  request_timeout: optionalNumber('request timeout'),
  enforce_rate_limits: optionalBoolean('enforce rate limits'),
  outbound_proxy_enabled: optionalBoolean('outbound proxy enabled'),
  request_detail_recording: optionalBoolean('request detail recording'),
  branding_display_name: optionalString('branding display name'),
  branding_tagline: optionalString('branding tagline'),
  branding_theme: optionalString('branding theme'),
}) satisfies z.ZodType<Partial<AppSettings>>

export type SettingsDto = z.infer<typeof SettingsSchema>
