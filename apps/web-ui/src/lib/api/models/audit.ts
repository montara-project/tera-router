import type { ISO8601DateString } from '@/types/time'

export type AuditOutcome = 'success' | 'failed'

/** One row of the audit trail. Request fields are empty for entries no
 * dashboard request wrote (gateway guardrail decisions, system start/stop). */
export interface AuditEntry {
  id: string
  /** User id, "system", "key:<name>" or "" for a refused sign-in. */
  actor: string
  action: string
  target: string
  /** Raw JSON object with action-specific details. */
  detail: string
  created_at: ISO8601DateString
  outcome: AuditOutcome
  session_id: string
  method: string
  /** Registered route pattern, e.g. /v1/keys/:id. */
  route: string
  /** Response status, 0 when no request wrote the entry. */
  status: number
  client_ip: string
  forwarded_for: string
  user_agent: string
  request_id: string
  /** Chain position; null for rows written before the chain existed. */
  seq: number | null
  prev_hash: string
  hash: string
}

export interface AuditStats {
  recorded: number
  failed: number
  /** Rows from before the hash chain, not covered by verification. */
  legacy: number
  /** Action prefixes present in the trail, e.g. "auth", "keys". */
  categories: string[]
  recorded_since_start: number
  /** Entries that failed to write since the server started. */
  lost: number
}

export interface AuditVerification {
  ok: boolean
  checked: number
  legacy: number
  broken_seq: number | null
  broken_id: string
  reason: string
}
