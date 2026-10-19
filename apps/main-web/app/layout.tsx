import type { Metadata } from 'next'

import { META, META_DESCRIPTION, META_IMAGE, META_URL } from '@/lib/constants/meta'

import './globals.css'

export const metadata: Metadata = META

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
  codeRepository: 'https://github.com/montara-project/tera-router',
  sameAs: ['https://github.com/montara-project/tera-router', 'https://docs.terarouter.xyz'],
})

// Resolves the stored theme before first paint so the page never flashes the
// wrong palette. Kept inline and dependency-free on purpose.
const themeInit = `(function(){try{var t=localStorage.getItem('tera-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
