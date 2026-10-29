import type { Option } from '@/types/select'

// IANA zones the browser knows; some engines leave UTC out of the list.
const ZONES = Intl.supportedValuesOf('timeZone')

export const TIMEZONE_OPTIONS: Option<string>[] = (
  ZONES.includes('UTC') ? ZONES : ['UTC', ...ZONES]
).map((tz) => ({ label: tz.replaceAll('_', ' '), value: tz }))
