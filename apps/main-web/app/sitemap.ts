import type { MetadataRoute } from 'next'

import { META_URL } from '@/lib/constants/meta'

// The landing page is the only page; the docs site publishes its own sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${META_URL}/` }]
}
