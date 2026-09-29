export function formatMb(value: number): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`
}

export function formatGb(value: number): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} GB`
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
