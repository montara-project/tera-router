import type { Metadata } from 'next'

/** The marketing site's canonical origin; the worker also answers on other hosts. */
export const META_URL = 'https://terarouter.xyz'
export const META_TITLE = 'Tera Router: Open Source AI Gateway for 20+ LLM Providers'
export const META_DESCRIPTION =
  'Open source, self-hosted AI gateway. Route OpenAI, Anthropic, Gemini, and 20+ LLM providers through one endpoint, with encrypted keys, fallback, and analytics.'
export const META_IMAGE = '/static/images/terarouter-thumbnail.png'
export const META_KEYWORDS =
  'ai gateway, llm gateway, open source ai gateway, self-hosted llm router, openai compatible api'

const SITE_NAME = 'Tera Router'

/** Site-wide defaults, set once on the root layout. */
export const META: Metadata = {
  metadataBase: new URL(META_URL),
  title: { default: META_TITLE, template: `%s - ${SITE_NAME}` },
  description: META_DESCRIPTION,
  keywords: META_KEYWORDS,
  applicationName: SITE_NAME,
  // og:/twitter: title and description are filled from each page's own.
  openGraph: {
    siteName: SITE_NAME,
    images: [{ url: META_IMAGE, width: 1672, height: 941, alt: SITE_NAME }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: [META_IMAGE] },
  icons: { icon: '/static/images/tera.png?v=3', apple: '/static/images/tera.png?v=3' },
}

/** One page's metadata. Leave out `title` to use the site default. */
export function pageMeta({
  title,
  description = META_DESCRIPTION,
  path,
}: {
  title?: string
  description?: string
  path: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...META.openGraph, url: path },
  }
}
