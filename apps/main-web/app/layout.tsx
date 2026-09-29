import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Tera Router — Unified AI Provider Gateway',
  description:
    'Self-hosted inference gateway that unifies every AI provider behind one OpenAI-compatible endpoint. Multi-dialect, multi-account, with keys, guardrails, and usage analytics.',
  icons: { icon: '/static/images/tera.png?v=3' },
}

// Resolves the stored theme before first paint so the page never flashes the
// wrong palette. Kept inline and dependency-free on purpose.
const themeInit = `(function(){try{var t=localStorage.getItem('tera-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
