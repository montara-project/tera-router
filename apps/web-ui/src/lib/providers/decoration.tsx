import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'

import ThemeProvider from './themes'

export default function DecorationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider>{children}</ThemeProvider>
    </NuqsAdapter>
  )
}
