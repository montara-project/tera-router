import type { ReactNode } from 'react'

import { DocsLayout } from 'fumadocs-ui/layouts/docs'

import { source } from '@/lib/source'

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <DocsLayout
      tree={source.getPageTree(lang)}
      nav={{ title: 'Tera Router' }}
      githubUrl="https://github.com/montara-project/tera-router"
    >
      {children}
    </DocsLayout>
  )
}
