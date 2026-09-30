'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'tera-theme'

type Theme = 'light' | 'dark' | 'system'

const options = [
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
  { value: 'system', label: 'System theme', Icon: Monitor },
] as const satisfies ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }>

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // storage can be unavailable (private mode, blocked cookies) — fall through
  }
  return 'system'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    setTheme(stored)
    setMounted(true)

    // Keep system mode in sync with OS changes while the page is open.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (readStoredTheme() === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function select(next: Theme) {
    setTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // persistence is best-effort; the in-memory choice still applies
    }
    applyTheme(next)
  }

  return (
    <div
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-raised/80 p-0.5"
      role="radiogroup"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            aria-checked={active}
            aria-label={label}
            className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 ${
              active
                ? 'bg-accent/15 text-accent-soft'
                : 'text-faint hover:bg-white/5 hover:text-ink'
            }`}
            key={value}
            onClick={() => select(value)}
            role="radio"
            type="button"
          >
            <Icon aria-hidden className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
