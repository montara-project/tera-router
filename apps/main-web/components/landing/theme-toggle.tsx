'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

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

const REVEAL_MS = 400

/**
 * Circle reveal from Magic UI's AnimatedThemeToggler: snapshot the page with
 * the View Transitions API, switch the theme, then grow the new snapshot out
 * of the clicked button. Coordinates are percentages of the viewport because
 * Chrome misplaces px clip-paths on fractional display scales (magicui#989).
 * Falls back to an instant switch without the API or under reduced motion.
 * `onDone` runs once the switch is fully over: right after the commit in the
 * fallback, or when the view transition finishes (or is skipped).
 */
function revealTheme(origin: HTMLElement, commit: () => void, onDone: () => void) {
  if (
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    commit()
    onDone()
    return
  }

  const w = window.innerWidth
  const h = window.innerHeight
  const { top, left, width, height } = origin.getBoundingClientRect()
  const x = left + width / 2
  const y = top + height / 2
  const maxRadius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))
  // circle() % radii resolve against hypot(w, h) / sqrt(2).
  const radius = (maxRadius / (Math.hypot(w, h) / Math.SQRT2)) * 100
  const at = `at ${(x / w) * 100}% ${(y / h) * 100}%`
  const clipPath = [`circle(0% ${at})`, `circle(${radius}% ${at})`]

  const root = document.documentElement
  root.dataset.themeVt = 'active'
  root.style.setProperty('--theme-vt-duration', `${REVEAL_MS}ms`)
  // Pin the collapsed circle in CSS so Firefox never paints the new theme
  // unclipped between the snapshot and the JS animation below.
  root.style.setProperty('--theme-vt-clip-from', clipPath[0])

  const transition = document.startViewTransition(() => flushSync(commit))
  transition.ready
    .then(() => {
      root.animate(
        { clipPath },
        {
          duration: REVEAL_MS,
          easing: 'ease-in-out',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    })
    .catch(() => {})
  transition.finished
    .finally(() => {
      delete root.dataset.themeVt
      root.style.removeProperty('--theme-vt-duration')
      root.style.removeProperty('--theme-vt-clip-from')
      onDone()
    })
    .catch(() => {})
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
  const revealing = useRef(false)

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

  function select(next: Theme, origin: HTMLElement) {
    const commit = () => {
      setTheme(next)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // persistence is best-effort; the in-memory choice still applies
      }
      applyTheme(next)
    }

    const willBeDark = next === 'dark' || (next === 'system' && systemPrefersDark())
    // Only animate a real palette flip, and never stack two reveals.
    if (revealing.current || willBeDark === document.documentElement.classList.contains('dark')) {
      if (!revealing.current) commit()
      return
    }
    revealing.current = true
    revealTheme(origin, commit, () => {
      revealing.current = false
    })
  }

  return (
    <div
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface/70 p-0.5 shadow-[var(--shadow-1)]"
      role="radiogroup"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            aria-checked={active}
            aria-label={label}
            className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 ${
              active ? 'bg-accent/15 text-accent-soft' : 'text-faint hover:bg-raised hover:text-ink'
            }`}
            key={value}
            onClick={(event) => select(value, event.currentTarget)}
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
