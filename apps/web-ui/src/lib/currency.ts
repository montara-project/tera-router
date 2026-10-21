/**
 * Format currency
 * @param value - Currency value
 * @returns Formatted currency string
 */
export const formatCurrency = (value: string) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(Number(value))
}

/** USD amount: 2 decimals from $1 up, 4 below so sub-cent costs stay visible. */
export function formatUsd(dollars: number): string {
  if (dollars === 0) return '$0.00'
  return `$${dollars.toFixed(dollars >= 1 ? 2 : 4)}`
}

/** USD amount stored as micros (1e-6 USD). */
export function formatMicrosUsd(micros: number): string {
  return formatUsd(micros / 1_000_000)
}

/** Render a USD-per-million rate; 0 shows "free" so a real zero is visible. */
export function formatRate(micros: number): string {
  if (micros === 0) return 'free'
  return `$${(micros / 1_000_000).toFixed(4).replace(/\.?0+$/, '')}`
}
