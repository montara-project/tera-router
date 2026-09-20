export type SourceCodeFilterMode = 'off' | 'minimal' | 'aggressive'

export type AppSettings = {
  rtkEnabled: boolean
  sourceCodeFilter: SourceCodeFilterMode
  cavemanEnabled: boolean
  terseEnabled: boolean
  headroomEnabled: boolean
  ponytailEnabled: boolean
  providerRoundRobin: boolean
  providerStickyLimit: number
  chainRoundRobin: boolean
  connectTimeout: number
  streamStallTimeout: number
  requestTimeout: number
  enforceRateLimits: boolean
  outboundProxyEnabled: boolean
  requestDetailRecording: boolean
  brandingDisplayName: string
  brandingTagline: string
  brandingTheme: string
}
