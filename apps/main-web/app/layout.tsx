import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Tera Router — Unified AI Provider Gateway',
  description:
    'Self-hosted inference gateway that unifies every AI provider behind one OpenAI-compatible endpoint. Multi-dialect, multi-account, with keys, guardrails, and usage analytics.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[#020617] font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
