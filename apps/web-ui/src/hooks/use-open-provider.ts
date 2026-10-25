import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { queries } from '@/lib/api/queries'

/**
 * Telemetry rows name providers by slug, while the detail route takes the
 * overview id (`prov-<slug>` or a custom-provider uuid). `openProvider(slug)`
 * resolves one to the other; unknown slugs land on the providers list.
 */
export function useOpenProvider() {
  const navigate = useNavigate()
  const { data } = useQuery(queries.providers.list())

  return (slug: string) => {
    const overview = data?.data
    const provider = [...(overview?.connected ?? []), ...(overview?.available ?? [])].find(
      (item) => item.slug === slug
    )
    if (provider) {
      void navigate({ to: '/providers/$providerId', params: { providerId: provider.id } })
    } else {
      void navigate({ to: '/providers' })
    }
  }
}
