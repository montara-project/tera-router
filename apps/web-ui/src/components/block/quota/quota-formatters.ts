export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return String(value)
}

export function formatCost(value: number): string {
  const decimals = value < 0.1 ? 4 : 2

  return `$${value.toFixed(decimals)}`
}
