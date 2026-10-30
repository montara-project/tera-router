import { createFileRoute } from '@tanstack/react-router'

import { i18n } from '@/lib/i18n'
import { META_URL, alternatesFor } from '@/lib/meta'
import { source } from '@/lib/source'

function urlEntry(url: string, languages: Record<string, string>): string {
  const alternates = Object.entries(languages)
    .map(
      ([lang, path]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${META_URL}${path}"/>`
    )
    .join('')
  return `<url><loc>${url}</loc>${alternates}</url>`
}

// Every locale's home and doc pages, each carrying its hreflang alternates —
// same shape the old Next.js app/sitemap.ts emitted.
function buildSitemap(): string {
  const abs = (languages: Record<string, string>) =>
    Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, p]))

  const entries: string[] = []
  for (const lang of i18n.languages) {
    const alt = alternatesFor(lang, '/')
    entries.push(urlEntry(META_URL + alt.canonical, abs(alt.languages)))
  }

  for (const lang of i18n.languages) {
    for (const page of source.getPages(lang)) {
      const path = `/docs${page.slugs.length ? `/${page.slugs.join('/')}` : ''}`
      const langs = (i18n.languages as string[]).filter((l) => source.getPage(page.slugs, l))
      const alt = alternatesFor(lang, path, langs)
      entries.push(urlEntry(META_URL + alt.canonical, abs(alt.languages)))
    }
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join('\n') +
    `\n</urlset>\n`
  )
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemap(), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        }),
    },
  },
})
