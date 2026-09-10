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
