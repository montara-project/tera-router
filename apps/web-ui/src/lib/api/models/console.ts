export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** One step of a request's timeline, offset from when it started. */
export type ConsoleEvent = {
  offsetMs: number
  /** received, routed, attempt_failed, completed, failed or rejected */
  kind: string
  text: string
}

/** The gateway's record of one API request. */
export type ConsoleRequest = {
  requestId: string
  /** "METHOD /path" */
  endpoint: string
  status: number
  /** completed; failed after an upstream attempt; rejected before any */
  outcome: 'completed' | 'failed' | 'rejected'
  reason?: string
  keyName?: string
  client?: string
  ip?: string
  model?: string
  servedBy?: string
  account?: string
  tokens: number
  /** "streaming" or "standard"; chunks counts the stream events sent. */
  mode?: string
  chunks?: number
  /** The last upstream failure, when an attempt failed. */
  provider?: string
  errorKind?: string
  upstreamStatus?: number
  retryAfterMs?: number
  upstreamMessage?: string
  durationMs: number
  /** RFC 3339 with milliseconds (UTC) */
  startedAt: string
  events: ConsoleEvent[]
}

export type ConsoleLogEntry = {
  id: number
  /** UTC wall clock, HH:mm:ss.SSS */
  time: string
  level: LogLevel
  message: string
  detail?: string
  /** Set on gateway request rows; plain lines leave it out. */
  request?: ConsoleRequest
}
