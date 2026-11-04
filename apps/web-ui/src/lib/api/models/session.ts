import type { ISO8601DateString } from '@/types/time'

/** An active dashboard sign-in; `current` is the session making the request. */
export interface Session {
  id: string
  user_agent: string
  ip_address: string
  expires_at: ISO8601DateString
  created_at: ISO8601DateString
  current: boolean
}
