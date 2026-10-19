import type { MetadataRoute } from 'next'

// The landing page is the only page; the docs site publishes its own sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://terarouter.xyz/' }]
}
