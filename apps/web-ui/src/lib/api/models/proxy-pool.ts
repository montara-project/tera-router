export type ProxyPoolStatus = 'active' | 'inactive'

export type ProxyPool = {
  id: string
  name: string
  url: string
  status: ProxyPoolStatus
  label?: string
  mode?: string
  tested_at: string
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
