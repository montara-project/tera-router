import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { HomeView } from '@/components/home-view'
import { i18n } from '@/lib/i18n'
import { landingHead } from '@/lib/meta'

export const Route = createFileRoute('/$lang/')({
  component: Page,
  // The default locale is served from unprefixed URLs, and unknown locales 404.
  beforeLoad: ({ params }) => {
    if (!(i18n.languages as string[]).includes(params.lang)) {
      throw notFound()
    }
    if (params.lang === i18n.defaultLanguage) {
      throw redirect({ href: '/' })
    }
  },
  head: ({ match }) => landingHead(match.params.lang),
})

function Page() {
  return <HomeView lang={Route.useParams().lang} />
}
