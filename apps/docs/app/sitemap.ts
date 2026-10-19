import type { MetadataRoute } from 'next'

import { alternatesFor, META_URL } from '@/lib/constants/meta'
import { i18n } from '@/lib/i18n'
import { source } from '@/lib/source'

// Every locale's home and doc pages, each carrying its hreflang alternates.
export default function sitemap(): MetadataRoute.Sitemap {
  const abs = (languages: Record<string, string>) =>
    Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, META_URL + p]))

  const entries: MetadataRoute.Sitemap = i18n.languages.map((lang) => {
    const alt = alternatesFor(lang, '/')
    return { url: META_URL + alt.canonical, alternates: { languages: abs(alt.languages) } }
  })

  for (const lang of i18n.languages) {
    for (const page of source.getPages(lang)) {
      const path = `/docs${page.slugs.length ? `/${page.slugs.join('/')}` : ''}`
      const langs = i18n.languages.filter((l) => source.getPage(page.slugs, l))
      const alt = alternatesFor(lang, path, langs)
      entries.push({ url: META_URL + alt.canonical, alternates: { languages: abs(alt.languages) } })
    }
  }
  return entries
}
