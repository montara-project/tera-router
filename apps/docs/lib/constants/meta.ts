import type { Metadata } from 'next'

import { i18n } from '@/lib/i18n'

export const META_URL = 'https://docs.terarouter.xyz'
export const META_TITLE = 'Tera Router Docs: Open Source AI Gateway'
// 320×320 square logo, so cards use the small "summary" layout.
export const META_IMAGE = '/tera.png'

const SITE_NAME = 'Tera Router'

const TITLES: Record<string, Metadata['title']> = {
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

// localePath prefixes a path with its locale; the default locale is served
// unprefixed (hideLocale: 'default-locale' in lib/i18n.ts).
export function localePath(lang: string, path: string): string {
  return lang === i18n.defaultLanguage ? path : `/${lang}${path === '/' ? '' : path}`
}

// alternatesFor builds the canonical plus hreflang set (each locale, itself
// included, and x-default) for a locale-independent path like /docs/gateway.
export function alternatesFor(lang: string, path: string, langs: string[] = i18n.languages) {
  const languages: Record<string, string> = {}
  for (const l of langs) {
    languages[l] = localePath(l, path)
  }
  languages['x-default'] = path
  return { canonical: localePath(lang, path), languages }
}

export function getMetadata(lang: string): Metadata {
  const resolved = (i18n.languages as string[]).includes(lang) ? lang : i18n.defaultLanguage
  const description = DESCRIPTIONS[resolved]

  return {
    metadataBase: new URL(META_URL),
    title: TITLES[resolved],
    description,
    alternates: alternatesFor(resolved, '/'),
    openGraph: {
      title: META_TITLE,
      description,
      url: localePath(resolved, '/'),
      siteName: SITE_NAME,
      images: [{ url: META_IMAGE, width: 320, height: 320, alt: 'Tera Router logo' }],
      locale: resolved.replace('-', '_'),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: META_TITLE,
      description,
      images: [META_IMAGE],
    },
    icons: {
      icon: '/favicon/favicon.ico',
      apple: '/favicon/apple-touch-icon.png',
      shortcut: '/favicon/favicon.ico',
    },
  }
}
