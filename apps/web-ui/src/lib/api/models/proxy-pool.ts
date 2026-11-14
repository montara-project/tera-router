export type ProxyPoolStatus = 'active' | 'inactive'

export type ProxyPool = {
  id: string
  /** accounts that route through this pool, counted by the server */
  accounts: number
  name: string
  url: string
  status: ProxyPoolStatus
  label?: string
  mode?: string
  /** null until the first probe */
  tested_at: string | null
  /** comma separated hosts that connect directly */
  bypass: string
  /** off: bound accounts connect directly */
  enabled: boolean
  /** unreachable pool fails the account instead of connecting directly */
  strict: boolean
}

export type RelayKind = 'cloudflare' | 'local'

/** POST /v1/proxy-pools/relay-script: a relay script with a fresh secret. */
export type RelayScript = {
  kind: RelayKind
  filename: string
  script: string
  /** relay+http(s)://:<secret>@RELAY_HOST… — RELAY_HOST is the user's host */
  pool_url: string
}
