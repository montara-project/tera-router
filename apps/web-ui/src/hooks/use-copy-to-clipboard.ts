'use client'

import * as React from 'react'

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number
  onCopy?: () => void
} = {}) {
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const copy = (value: string) => {
    if (typeof window === 'undefined' || !navigator.clipboard.writeText) {
      return
    }

    if (!value) return

    navigator.clipboard.writeText(value).then(() => {
      // Restart the window on every copy so rapid re-clicks keep the copied
      // state alive instead of an older timer resetting it early.
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setCopied(true)

      if (onCopy) {
        onCopy()
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setCopied(false)
      }, timeout)
    }, console.error)
  }

  return { copied, copy }
}
