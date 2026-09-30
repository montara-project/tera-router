import { z } from 'zod'

import { optionalString, requiredString } from '@/lib/validation'

import type { ProxyPool } from '../../models/proxy-pool'

type ProxyPoolPayload = Pick<ProxyPool, 'name' | 'url'> & Partial<Pick<ProxyPool, 'mode' | 'label'>>

/** Proxy pool create/update body (POST/PUT/PATCH /v1/proxy-pools). */
export const ProxyPoolSchema = z.object({
  name: requiredString('name'),
  url: requiredString('url'),
  mode: optionalString('mode'),
  label: optionalString('label'),
}) satisfies z.ZodType<ProxyPoolPayload>

export type ProxyPoolDto = z.infer<typeof ProxyPoolSchema>
