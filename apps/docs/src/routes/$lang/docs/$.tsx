import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { DocsPageView, fetchDocsPage } from '@/components/docs-page'
import { i18n } from '@/lib/i18n'
import { docsHead } from '@/lib/meta'
import { docs } from '@/lib/source'

export const Route = createFileRoute('/$lang/docs/$')({
  component: Page,
  // The default locale is served from unprefixed URLs, and unknown locales 404.
  beforeLoad: ({ params }) => {
    if (!(i18n.languages as string[]).includes(params.lang)) {
      throw notFound()
    }
    if (params.lang === i18n.defaultLanguage) {
      throw redirect({ href: `/docs${params._splat ? `/${params._splat}` : ''}` })
    }
  },
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? []
    const data = await fetchDocsPage(slugs, params.lang)
    await docs.getPage(data.path)?.preload()
    return data
  },
  head: ({ match }) => {
    const d = match.loaderData
    return d ? docsHead(d) : {}
  },
})

function Page() {
  return <DocsPageView data={Route.useLoaderData()} />
}
