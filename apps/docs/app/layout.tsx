import './global.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { RootProvider } from 'fumadocs-ui/provider/next'

export const metadata: Metadata = {
  title: {
    default: 'Tera Router Docs',
    template: '%s — Tera Router',
  },
  description:
    'Dokumentasi Tera Router — self-hosted LLM gateway dengan format OpenAI, Anthropic, dan Responses API.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
