import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queries } from '@/lib/api/queries'

export const DEFAULT_LOGO = '/static/images/tera.png'
const DEFAULT_NAME = 'Tera Router'

/** Instance branding with the built-in defaults filled in. */
export function useBranding() {
  const { data } = useQuery(queries.settings.branding())
  return {
    name: data?.display_name || DEFAULT_NAME,
    tagline: data?.tagline ?? '',
    logo: data?.logo || DEFAULT_LOGO,
    favicon: data?.favicon ?? '',
  }
}

/** Swaps the page favicon for the instance's custom one, when set. */
export function useBrandingFavicon() {
  const { favicon } = useBranding()

  useEffect(() => {
    if (!favicon) return
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')]
    const originals = links.map((link) => link.href)
    for (const link of links) link.href = favicon
    return () => links.forEach((link, i) => (link.href = originals[i]))
  }, [favicon])
}
