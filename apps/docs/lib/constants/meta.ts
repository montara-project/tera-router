import type { Metadata } from 'next'

import { i18n } from '@/lib/i18n'

export const META_URL = 'https://terarouter.xyz'
export const META_TITLE = 'Tera Router — Unified AI Provider Gateway'
export const META_IMAGE = '/tera.png'
export const META_KEYWORDS =
  'llm gateway, ai gateway, inference gateway, openai compatible api, anthropic compatible api, llm router, provider routing'

const SITE_NAME = 'Tera Router'

const TITLES: Record<string, Metadata['title']> = {
  'en-US': { default: 'Tera Router Docs', template: '%s — Tera Router' },
  'id-ID': { default: 'Tera Router Docs', template: '%s — Tera Router' },
}

const DESCRIPTIONS: Record<string, string> = {
  'en-US':
    'Tera Router documentation — self-hosted LLM gateway speaking the OpenAI, Anthropic, and Responses API formats.',
  'id-ID':
    'Dokumentasi Tera Router — self-hosted LLM gateway dengan format OpenAI, Anthropic, dan Responses API.',
}

export function getMetadata(lang: string): Metadata {
  const resolved = (i18n.languages as string[]).includes(lang) ? lang : i18n.defaultLanguage
  const description = DESCRIPTIONS[resolved]

  return {
    metadataBase: new URL(META_URL),
    title: TITLES[resolved],
    description,
    keywords: META_KEYWORDS,
    openGraph: {
      title: META_TITLE,
      description,
      url: META_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: META_IMAGE,
          width: 1200,
          height: 630,
          alt: META_TITLE,
        },
      ],
      locale: resolved.replace('-', '_'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
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
