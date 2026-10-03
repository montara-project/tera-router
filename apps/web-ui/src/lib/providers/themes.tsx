import { ThemeProvider as NextThemesProvider } from 'next-themes'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_THEME_PALETTE,
  STORAGE_KEY_THEME_PALETTE,
  resolveThemePalette,
} from '@/lib/theme-palettes'

/**
 * Theme provider (light / dark / system)
 * @param params
 * @returns
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      storageKey="tera-router-theme"
      defaultTheme="dark"
      attribute="class"
      disableTransitionOnChange
      enableColorScheme
      enableSystem
    >
      {children}
    </NextThemesProvider>
  )
}

interface ThemePaletteContextValue {
  palette: string
  setPalette: (palette: string) => void
}

const ThemePaletteContext = createContext<ThemePaletteContextValue | undefined>(undefined)

function readStoredPalette(): string {
  try {
    return resolveThemePalette(localStorage.getItem(STORAGE_KEY_THEME_PALETTE))
  } catch {
    return DEFAULT_THEME_PALETTE
  }
}

/**
 * Color palette provider — applies `data-theme` on <html> and persists the
 * choice in localStorage so the palette survives reloads.
 * @param params
 * @returns
 */
export function ThemePaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState(readStoredPalette)

  useEffect(() => {
    document.documentElement.dataset.theme = palette
  }, [palette])

  const value = useMemo<ThemePaletteContextValue>(
    () => ({
      palette,
      setPalette: (next) => {
        const resolved = resolveThemePalette(next)

        try {
          localStorage.setItem(STORAGE_KEY_THEME_PALETTE, resolved)
        } catch {
          // localStorage unavailable — keep the in-memory choice
        }
        setPaletteState(resolved)
      },
    }),
    [palette]
  )

  return <ThemePaletteContext.Provider value={value}>{children}</ThemePaletteContext.Provider>
}

export function useThemePalette(): ThemePaletteContextValue {
  const context = useContext(ThemePaletteContext)

  if (!context) {
    throw new Error('useThemePalette must be used within a ThemePaletteProvider')
  }

  return context
}
