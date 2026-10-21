const integerFormat = new Intl.NumberFormat('en-US')
const decimalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const oneDecimalFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Short magnitude, e.g. 1.2K, 3.4M, 5.6B, 7.8T. */
export function formatCompact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return `${n}`
}

/** Integer with grouping, e.g. 12,345. */
export function formatCount(n: number): string {
  return integerFormat.format(n)
}

/** Up to two decimals, trailing zeros dropped, e.g. 1.5, 0.25. */
export function formatDecimal(n: number): string {
  return decimalFormat.format(n)
}

/** Milliseconds as seconds, e.g. 1.23s. */
export function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1e3).toFixed(1)} KB`
}

export function formatMb(mb: number): string {
  return `${oneDecimalFormat.format(mb)} MB`
}

export function formatGb(gb: number): string {
  return `${oneDecimalFormat.format(gb)} GB`
}

/** Human file size, e.g. 1.5 MB. */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / k ** i).toFixed(dm)) + sizes[i]
}
