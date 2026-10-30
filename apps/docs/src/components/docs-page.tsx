import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { Suspense } from 'react'

import { useMDXComponents } from '@/components/mdx'
import { i18n } from '@/lib/i18n'
import { baseOptions } from '@/lib/layout.shared'
import { docs, source } from '@/lib/source'

const serverLoader = createServerFn({ method: 'GET' })
  .validator((input: { slugs: string[]; lang: string }) => input)
  .handler(async ({ data }) => {
    const page = source.getPage(data.slugs, data.lang)
    if (!page) throw notFound()

    // hreflang only lists locales that actually translate this page.
    return {
      path: page.path,
      lang: data.lang,
      urlPath: `/docs${data.slugs.length ? `/${data.slugs.join('/')}` : ''}`,
      title: page.data.title,
      description: page.data.description ?? undefined,
      langs: (i18n.languages as string[]).filter((l) => source.getPage(data.slugs, l)),
      pageTree: await source.serializePageTree(source.getPageTree(data.lang)),
    }
  })

// fetchDocsPage runs inside route loaders; routes preload the MDX module
// after this resolves so navigation renders without a flash.
export function fetchDocsPage(slugs: string[], lang: string) {
  return serverLoader({ data: { slugs, lang } })
}

function Content({ path }: { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown page: ${path}`)

  const MDX = page.body

  return (
    <DocsPage toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      {page.description && <DocsDescription>{page.description}</DocsDescription>}
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export function DocsPageView({ data }: { data: Awaited<ReturnType<typeof fetchDocsPage>> }) {
  const d = useFumadocsLoader(data)

  return (
    <DocsLayout {...baseOptions()} tree={d.pageTree}>
      <Suspense fallback={null}>
        <Content path={d.path} />
      </Suspense>
    </DocsLayout>
  )
}
