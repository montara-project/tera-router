import type { Metadata } from 'next'

import './globals.css'

const SITE_URL = 'https://terarouter.xyz'
const TITLE = 'Tera Router: Open Source AI Gateway for 20+ LLM Providers'
const DESCRIPTION =
  'Open source, self-hosted AI gateway. Route OpenAI, Anthropic, Gemini, and 20+ LLM providers through one OpenAI-compatible endpoint with fallback and analytics.'
const LOGO = '/static/images/tera.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Tera Router',
    // 320×320 square logo, so cards use the small "summary" layout.
    images: [{ url: LOGO, width: 320, height: 320, alt: 'Tera Router logo' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION, images: [LOGO] },
  icons: { icon: `${LOGO}?v=3` },
}

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Tera Router',
  description: DESCRIPTION,
  url: SITE_URL,
  image: SITE_URL + LOGO,
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
