import { createFileRoute } from '@tanstack/react-router'

import { HomeView } from '@/components/home-view'
import { i18n } from '@/lib/i18n'
import { landingHead } from '@/lib/meta'

export const Route = createFileRoute('/')({
  component: Page,
  head: () => landingHead(i18n.defaultLanguage),
})

function Page() {
  return <HomeView lang={i18n.defaultLanguage} />
}
