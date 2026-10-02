import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const SYSTEM_QUERY_KEY = 'system'

export const STATS_SYSTEM_QUERY_KEY = () => {
  return [SYSTEM_QUERY_KEY, 'stats']
}

const stats = () =>
  queryOptions({
    queryKey: STATS_SYSTEM_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.system.stats()
      return res.data
    },
    refetchInterval: 5000,
  })

export const HEALTH_SYSTEM_QUERY_KEY = () => {
  return [SYSTEM_QUERY_KEY, 'health']
}

const health = () =>
  queryOptions({
    queryKey: HEALTH_SYSTEM_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.system.health()
      return res.data
    },
    staleTime: 60_000,
  })

const RELEASES_API_URL = 'https://api.github.com/repos/montara-project/tera-router'
const RELEASES_PAGE_URL = 'https://github.com/montara-project/tera-router/releases'

export interface LatestRelease {
  tag: string
  url: string
}

/** Numeric semver comparison ("0.4.2" > "0.4.10" handled part by part). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const fetchLatestRelease = async (): Promise<LatestRelease> => {
  // the repo publishes image tags without GitHub Releases, so read tags and
  // pick the highest semver client-side (the endpoint is not order-guaranteed)
  const res = await fetch(`${RELEASES_API_URL}/tags?per_page=30`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status}`)
  }
  const tags = (await res.json()) as { name: string }[]
  const semverTags = tags.map((tag) => tag.name).filter((name) => /^v?\d+(\.\d+)*$/.test(name))
  if (semverTags.length === 0) {
    throw new Error('No version tags found')
  }
  const tag = semverTags.sort((a, b) =>
    compareVersions(b.replace(/^v/, ''), a.replace(/^v/, ''))
  )[0]
  return { tag, url: `${RELEASES_PAGE_URL}/tag/${tag}` }
}

const checkLatestRelease = () => mutationOptions({ mutationFn: fetchLatestRelease })

export const systemQueries = {
  stats,
  health,
  checkLatestRelease,
} as const
