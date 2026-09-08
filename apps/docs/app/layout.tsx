import './global.css'

import type { ReactNode } from 'react'

import { RootProviderWrapper } from '@/components/root-provider'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProviderWrapper>{children}</RootProviderWrapper>
      </body>
    </html>
  )
}
