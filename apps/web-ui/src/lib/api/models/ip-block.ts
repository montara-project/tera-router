import type { ISO8601DateString } from '@/types/time'

/** A blocked client address or range; `expires_at` null means permanent. */
export interface IPBlock {
  id: string
  cidr: string
  reason: string
  expires_at: ISO8601DateString | null
  created_at: ISO8601DateString
}
