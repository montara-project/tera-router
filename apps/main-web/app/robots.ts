import type { MetadataRoute } from 'next'

import { META_URL } from '@/lib/constants/meta'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${META_URL}/sitemap.xml`,
  }
}
