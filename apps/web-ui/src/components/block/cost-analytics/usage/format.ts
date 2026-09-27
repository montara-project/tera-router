export function fmtCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return `${n}`
}

export function fmtMoney(micros: number): string {
  const dollars = micros / 1e6
  if (dollars === 0) return '$0.00'
  return `$${dollars.toFixed(dollars >= 1 ? 2 : 4)}`
}

export function fmtLatency(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

export function fmtKb(bytes: number): string {
  return `${(bytes / 1e3).toFixed(1)} KB`
}
