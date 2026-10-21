import type { Metadata } from 'next'

import { DOCS_URL, GITHUB_URL } from '@/components/landing/section'
import { META, META_DESCRIPTION, META_IMAGE, META_URL } from '@/lib/constants/meta'

import { version } from '../package.json'
import './globals.css'

export const metadata: Metadata = META

// `<` is escaped so no string in the data can close the <script> early.
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Tera Router',
  description: META_DESCRIPTION,
  url: META_URL,
  image: META_URL + META_IMAGE,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows (Docker)',
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  softwareVersion: version,
  author: { '@type': 'Organization', name: 'Montara Projects', url: GITHUB_URL },
  codeRepository: GITHUB_URL,
  sameAs: [GITHUB_URL, DOCS_URL],
}).replace(/</g, '\\u003c')

// Linked from <head> rather than @import-ed in globals.css, so the font CSS
// downloads in parallel with the app CSS instead of after it. Weights are the
// ones the page uses: Outfit 300-500 (display), Plus Jakarta Sans 400-700,
// JetBrains Mono 400.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap'

// Resolves the stored theme before first paint so the page never flashes the
// wrong palette. Kept inline and dependency-free on purpose.
const themeInit = `(function(){try{var t=localStorage.getItem('tera-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link href={FONTS_URL} rel="stylesheet" />
        <script
          defer
          src="https://analytics.masb0ymas.com/script.js"
          data-website-id="aefcb7e9-8cd5-4504-9ab5-9070c29d33de"
        ></script>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
