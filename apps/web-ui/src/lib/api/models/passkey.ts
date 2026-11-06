import type { ISO8601DateString } from '@/types/time'

/** A passkey that signs its owner in; it works only on the host `rp_id`. */
export interface Passkey {
  id: string
  name: string
  rp_id: string
  last_used_at: ISO8601DateString | null
  created_at: ISO8601DateString
}
