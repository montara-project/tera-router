import type { MetadataRoute } from 'next'

import { META_URL } from '@/lib/constants/meta'

// The landing page and the legal pages (/terms, /privacy) are the only pages;
// the docs site publishes its own sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${META_URL}/` },
    {
      url: `${META_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${META_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
