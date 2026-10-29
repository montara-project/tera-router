/**
 * Allowlist-only period. Empty dates or times leave that side open;
 * `start_time`/`end_time` repeat daily and may wrap past midnight.
 */
export interface RestrictedAccess {
  enabled: boolean
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  timezone: string
  allowed_ips: string[]
}
