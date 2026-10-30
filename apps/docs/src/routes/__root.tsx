import type { ReactNode } from 'react'

import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from '@tanstack/react-router'
import { i18nProvider } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'

import { i18n, translations } from '@/lib/i18n'
import { rootHead } from '@/lib/meta'
import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  head: () => {
    const base = rootHead()
    return {
      ...base,
      links: [{ rel: 'stylesheet', href: appCss }, ...base.links],
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const raw = useParams({ strict: false }).lang
  const lang = (i18n.languages as string[]).includes(raw as string)
    ? (raw as string)
    : i18n.defaultLanguage

  return (
    <RootDocument>
      <RootProvider i18n={i18nProvider(translations, lang)}>
        <Outlet />
      </RootProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const raw = useParams({ strict: false }).lang
  const lang = (i18n.languages as string[]).includes(raw as string)
    ? (raw as string)
    : i18n.defaultLanguage

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-svh flex-col">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
