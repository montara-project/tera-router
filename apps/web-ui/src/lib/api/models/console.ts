export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type ConsoleLogEntry = {
  id: number
  time: string
  level: LogLevel
  message: string
  detail?: string
}
