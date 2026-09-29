export type SourceCodeFilterMode = 'off' | 'minimal' | 'aggressive'

export type AppSettings = {
  rtk_enabled: boolean
  source_code_filter: SourceCodeFilterMode
  caveman_enabled: boolean
  terse_enabled: boolean
  headroom_enabled: boolean
  ponytail_enabled: boolean
  provider_round_robin: boolean
  provider_sticky_limit: number
  chain_round_robin: boolean
  connect_timeout: number
  stream_stall_timeout: number
  request_timeout: number
  enforce_rate_limits: boolean
  outbound_proxy_enabled: boolean
  request_detail_recording: boolean
  branding_display_name: string
  branding_tagline: string
  branding_theme: string
}
