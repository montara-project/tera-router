import { i18n } from '@/lib/i18n'

export const META_URL = 'https://docs.terarouter.xyz'
export const META_TITLE = 'Tera Router Docs: Open Source AI Gateway'
// 320×320 square logo, so cards use the small "summary" layout.
export const META_IMAGE = '/tera.png'

const SITE_NAME = 'Tera Router'

const TITLES: Record<string, { default: string; template: string }> = {
  'en-US': { default: META_TITLE, template: '%s | Tera Router Docs' },
  'id-ID': {
    default: 'Dokumentasi Tera Router: AI Gateway Open Source',
    template: '%s | Tera Router Docs',
  },
}

const DESCRIPTIONS: Record<string, string> = {
  'en-US':
    'Documentation for Tera Router, the open source, self-hosted AI gateway that routes 20+ LLM providers through one OpenAI, Anthropic, or Responses API endpoint.',
  'id-ID':
    'Dokumentasi Tera Router, AI gateway open source dan self-hosted yang merutekan 20+ provider LLM lewat satu endpoint OpenAI, Anthropic, atau Responses API.',
}

type HeadMeta = Record<string, string | number | boolean | undefined>
type HeadLink = Record<string, string | undefined>
type Alternates = ReturnType<typeof alternatesFor>

// resolveLang falls back to the default locale for unknown values, matching
// the old Next.js generateMetadata guard.
function resolveLang(lang: string): string {
  return (i18n.languages as string[]).includes(lang) ? lang : i18n.defaultLanguage
}

// localePath prefixes a path with its locale; the default locale is served
// unprefixed (hideLocale: 'default-locale' in lib/i18n.ts).
export function localePath(lang: string, path: string): string {
  return lang === i18n.defaultLanguage ? path : `/${lang}${path === '/' ? '' : path}`
}

// alternatesFor builds the canonical plus hreflang set (each locale, itself
// included, and x-default) for a locale-independent path like /docs/gateway.
export function alternatesFor(
  lang: string,
  path: string,
  langs: string[] = i18n.languages as string[]
) {
  const languages: Record<string, string> = {}
  for (const l of langs) {
    languages[l] = localePath(l, path)
  }
  languages['x-default'] = path
  return { canonical: localePath(lang, path), languages }
}

function alternatesLinks(alt: Alternates): HeadLink[] {
  const links: HeadLink[] = [{ rel: 'canonical', href: META_URL + alt.canonical }]
  for (const [lang, path] of Object.entries(alt.languages)) {
    links.push({ rel: 'alternate', hreflang: lang, href: META_URL + path })
  }
  return links
}

// rootHead emits charset, viewport, icons, and the analytics loader — entries
// shared by every page. Page routes add title/OG/canonical on top.
export function rootHead(): { meta: HeadMeta[]; links: HeadLink[]; scripts: HeadMeta[] } {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'icon', href: '/favicon/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png' },
    ],
    scripts: [
      {
        src: 'https://analytics.masb0ymas.com/script.js',
        defer: true,
        'data-website-id': '682f23b6-27c4-4c88-b740-8f2cca76916e',
      },
    ],
  }
}

function landingHead(lang: string): { meta: HeadMeta[]; links: HeadLink[] } {
  const resolved = resolveLang(lang)
  const description = DESCRIPTIONS[resolved]
  const url = META_URL + localePath(resolved, '/')

  return {
    meta: [
      { title: TITLES[resolved].default },
      { name: 'description', content: description },
      { property: 'og:title', content: META_TITLE },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:siteName', content: SITE_NAME },
      { property: 'og:image', content: META_URL + META_IMAGE },
      { property: 'og:image:width', content: '320' },
      { property: 'og:image:height', content: '320' },
      { property: 'og:image:alt', content: 'Tera Router logo' },
      { property: 'og:locale', content: resolved.replace('-', '_') },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: META_TITLE },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: META_URL + META_IMAGE },
    ],
    links: alternatesLinks(alternatesFor(resolved, '/')),
  }
}

export type DocsHeadData = {
  lang: string
  urlPath: string
  title: string
  description?: string
  langs: string[]
}

function docsHead(data: DocsHeadData): { meta: HeadMeta[]; links: HeadLink[] } {
  const resolved = resolveLang(data.lang)
  const description = data.description
  const alt = alternatesFor(resolved, data.urlPath, data.langs)
  const title = `${data.title} | Tera Router Docs`

  return {
    meta: [
      { title },
      ...(description ? [{ name: 'description', content: description }] : []),
      { property: 'og:title', content: title },
      ...(description ? [{ property: 'og:description', content: description }] : []),
      { property: 'og:url', content: META_URL + alt.canonical },
      { property: 'og:siteName', content: SITE_NAME },
      { property: 'og:image', content: META_URL + META_IMAGE },
      { property: 'og:image:alt', content: 'Tera Router logo' },
      { property: 'og:locale', content: resolved.replace('-', '_') },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      ...(description ? [{ name: 'twitter:description', content: description }] : []),
      { name: 'twitter:image', content: META_URL + META_IMAGE },
    ],
    links: alternatesLinks(alt),
  }
}

export { docsHead, landingHead }
