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

/** Render a USD-per-million rate; 0 shows "free" so a real zero is visible. */
export function formatRate(micros: number): string {
  if (micros === 0) return 'free'
  return `$${(micros / 1_000_000).toFixed(4).replace(/\.?0+$/, '')}`
}
