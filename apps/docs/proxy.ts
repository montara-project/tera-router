import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware'

import { i18n } from '@/lib/i18n'

// Locale-aware rewrite/redirect: unprefixed URLs serve the default locale
// (en-US), /id-ID/... serves Indonesian, /en-US/... redirects to unprefixed.
export default createI18nMiddleware(i18n)

export const config = {
  // Skip _next assets and anything with a file extension (public/ assets, icons, etc)
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
