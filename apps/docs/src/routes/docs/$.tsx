import { createFileRoute } from '@tanstack/react-router'

import { DocsPageView, fetchDocsPage } from '@/components/docs-page'
import { i18n } from '@/lib/i18n'
import { docsHead } from '@/lib/meta'
import { docs } from '@/lib/source'

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? []
    const data = await fetchDocsPage(slugs, i18n.defaultLanguage)
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
