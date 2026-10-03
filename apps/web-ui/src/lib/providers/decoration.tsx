import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'

import ThemeProvider, { ThemePaletteProvider } from './themes'

export default function DecorationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider>
        <ThemePaletteProvider>{children}</ThemePaletteProvider>
      </ThemeProvider>
    </NuqsAdapter>
  )
}
