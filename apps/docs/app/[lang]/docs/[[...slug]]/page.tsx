import type { Metadata } from 'next'

import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'

import { getMDXComponents } from '@/components/mdx-components'
import { alternatesFor } from '@/lib/constants/meta'
import { i18n } from '@/lib/i18n'
import { source } from '@/lib/source'

type Params = Promise<{ slug?: string[]; lang: string }>

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: { params: Params }): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug, params.lang)
  if (!page) {
    notFound()
  }

  // hreflang only lists locales that actually translate this page.
  const path = `/docs${params.slug?.length ? `/${params.slug.join('/')}` : ''}`
  const langs = i18n.languages.filter((l) => source.getPage(params.slug, l))
  const alternates = alternatesFor(params.lang, path, langs)

  return {
    title: page.data.title,
    description: page.data.description,
    alternates,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: alternates.canonical,
      type: 'article',
    },
    twitter: { title: page.data.title, description: page.data.description },
  }
}

export default async function Page(props: { params: Params }) {
  const params = await props.params
  const page = source.getPage(params.slug, params.lang)
  if (!page) {
    notFound()
  }

  const MDXContent = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && <DocsDescription>{page.data.description}</DocsDescription>}
      <DocsBody>
        <MDXContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}
