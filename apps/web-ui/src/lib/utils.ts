import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes
 * @param inputs - Class names to merge
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checked state for a "select all" checkbox
 * @param all - Every row is selected
 * @param some - At least one row is selected
 */
export function selectAllState(all: boolean, some: boolean): boolean | 'indeterminate' {
  if (all) return true
  if (some) return 'indeterminate'
  return false
}
