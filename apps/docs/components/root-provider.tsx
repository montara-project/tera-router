'use client'

import type { RootProviderProps } from 'fumadocs-ui/provider/next'

import { RootProvider } from 'fumadocs-ui/provider/next'

export function RootProviderWrapper({ theme, ...props }: RootProviderProps) {
  return (
    <RootProvider
      {...props}
      theme={{
        ...theme,
        // next-themes renders an inline <script> to set the theme before
        // hydration (prevents FOUC). React 19 warns about <script> tags inside
        // client components. On the server it renders as executable JS; on the
        // client we mark it as a data block so React skips the warning since the
        // script already ran during SSR.
        scriptProps: typeof window === 'undefined' ? undefined : { type: 'application/json' },
      }}
    />
  )
}
