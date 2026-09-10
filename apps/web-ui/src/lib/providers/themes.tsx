import { ThemeProvider as NextThemesProvider } from 'next-themes'
import React from 'react'

/**
 * Theme provider
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
