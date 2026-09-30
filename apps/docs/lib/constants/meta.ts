import { Metadata } from 'next'


export const META_URL = 'https://terarouter.xyz'
export const META_TITLE = `Tera Router — Unified AI Provider Gateway`
export const META_DESCRIPTION = `Self-hosted inference gateway that unifies every AI provider behind one OpenAI-compatible endpoint. Multi-dialect, multi-account, with keys, guardrails, and usage analytics.`
export const META_IMAGE = '/tera.png'
export const META_KEYWORDS = `llm gateway, ai gateway, inference gateway, openai compatible api, anthropic compatible api, llm router, provider routing`

const SITE_NAME = 'Tera Router'

export const META: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  keywords: META_KEYWORDS,
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
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
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TITLE,
    description: META_DESCRIPTION,
    site: META_URL,
    creator: SITE_NAME,
    images: [META_IMAGE],
  },
  icons: {
    icon: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
    shortcut: '/favicon/favicon.ico',
    other: {
      rel: 'shortcut icon',
      url: '/favicon/favicon.ico',
    },
  },
} as const