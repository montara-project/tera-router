import { useTheme } from 'next-themes'
import { flushSync } from 'react-dom'

export type ThemeChoice = 'light' | 'dark' | 'system'

const DURATION_MS = 400

const resolve = (choice: ThemeChoice): 'light' | 'dark' =>
  choice === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : choice

/**
 * Theme switching with Magic UI's animated theme toggler reveal
 * (magicui.design/docs/components/animated-theme-toggler): the new theme grows
 * as a circle from the control that picked it, through the View Transitions
 * API. Adapted to next-themes and to light / dark / system. The circle is
 * skipped when the shown theme does not change, when the browser has no
 * startViewTransition, and under prefers-reduced-motion.
 */
export function useAnimatedTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const changeTheme = (choice: ThemeChoice, origin?: HTMLElement | null) => {
    const next = resolve(choice)
    const root = document.documentElement
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (
      !origin ||
      next === resolvedTheme ||
      reducedMotion ||
      typeof document.startViewTransition !== 'function'
    ) {
      setTheme(choice)
      return
    }

    const { top, left, width, height } = origin.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))
    // Percentages of the snapshot box, as in Magic UI: px clip paths land in the
    // wrong place on fractional display scales.
    const at = `${(x / vw) * 100}% ${(y / vh) * 100}%`
    const radius = `${(maxRadius / (Math.hypot(vw, vh) / Math.SQRT2)) * 100}%`

    const transition = document.startViewTransition(() => {
      // Swap the class now so the new snapshot already shows the new theme;
      // next-themes then stores the choice and re-applies the same class.
      flushSync(() => {
        root.classList.remove('light', 'dark')
        root.classList.add(next)
        root.style.colorScheme = next
        setTheme(choice)
      })
    })
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0% at ${at})`, `circle(${radius} at ${at})`] },
          {
            duration: DURATION_MS,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      })
      .catch(() => {})
  }

  return { theme: (theme ?? 'system') as ThemeChoice, changeTheme }
}
