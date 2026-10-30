import { createFileRoute } from '@tanstack/react-router'

import { META_URL } from '@/lib/meta'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(`User-agent: *\nAllow: /\n\nSitemap: ${META_URL}/sitemap.xml\n`, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
    },
  },
})
