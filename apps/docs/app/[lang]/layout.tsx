import '../global.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { i18nProvider } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { notFound } from 'next/navigation'

import { getMetadata } from '@/lib/constants/meta'
import { i18n, translations } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return getMetadata(lang)
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!(i18n.languages as string[]).includes(lang)) {
    notFound()
  }

  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        <RootProvider i18n={i18nProvider(translations, lang)}>{children}</RootProvider>
      </body>
    </html>
  )
}
