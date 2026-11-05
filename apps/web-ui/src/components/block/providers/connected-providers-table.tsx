import { IconPlugConnected, IconSearch, IconTrash } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { HealthBadge, HealthTimeline } from '@/components/block/dashboard/overview-provider-health'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { formatCount, formatMs } from '@/lib/format'

import { PROVIDER_CAPABILITIES } from './connect-provider-dialog'

interface ConnectedProvidersTableProps {
  providers: Models.Provider[]
  /** 24h health entries keyed by provider slug */
  health: Map<string, Models.HealthEntry>
  /** connected providers with no account; offered for cleanup */
  emptyCount: number
  onDeleteEmpty: () => void
  deleting: boolean
}

export default function ConnectedProvidersTable({
  providers,
  health,
  emptyCount,
  onDeleteEmpty,
  deleting,
}: ConnectedProvidersTableProps) {
  const [search, setSearch] = useState('')
  const [capability, setCapability] = useState('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" jumps to search, as the hint in the field says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== '/' || target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const q = search.trim().toLowerCase()
  const rows = providers.filter(
    (p) =>
      (capability === 'all' || p.capabilities.includes(capability as Models.ProviderCapability)) &&
      (!q || `${p.name} ${p.slug}`.toLowerCase().includes(q))
  )

  return (
    <DashboardPanel
      icon={IconPlugConnected}
      title="Connected"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {emptyCount > 0 && (
            <Button variant="outline" size="sm" disabled={deleting} onClick={onDeleteEmpty}>
              <IconTrash />
              Delete empty ({emptyCount})
            </Button>
          )}
          <InputWrapper className="w-full sm:w-64">
            <IconSearch aria-hidden />
            <Input
              ref={searchRef}
              type="search"
              aria-label="Search connected providers"
              aria-keyshortcuts="/"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="rounded-sm border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
              /
            </kbd>
          </InputWrapper>
          <select
            aria-label="Capability"
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="all">All capabilities</option>
            {PROVIDER_CAPABILITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={IconPlugConnected}
          title={providers.length === 0 ? 'No providers connected yet' : 'No providers match'}
          description={
            providers.length === 0
              ? 'Connect a provider to start routing requests through it.'
              : 'Try a different search or capability.'
          }
          className="py-10"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-[30%] px-4 py-2 text-left font-medium">Provider</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Accounts</th>
                <th className="w-44 px-4 py-2 text-left font-medium">Last 24 hours</th>
                <th className="px-4 py-2 text-right font-medium">Requests</th>
                <th className="px-4 py-2 text-right font-medium">Success</th>
                <th className="px-4 py-2 text-right font-medium">p95</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const h = health.get(p.slug)
                const traffic = h && h.requests > 0 ? h : undefined
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="max-w-0 px-4 py-2.5">
                      <Link
                        to="/providers/$providerId"
                        params={{ providerId: p.id }}
                        className="group flex min-w-0 items-center gap-2.5 rounded-sm"
                      >
                        <ProviderAvatar
                          slug={p.slug}
                          apiKind={p.api_kind}
                          size="xs"
                          className="size-6"
                        />
                        <span className="min-w-0">
                          <span
                            className="block truncate font-medium group-hover:underline"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <span
                            className="block truncate text-[11.5px] text-muted-foreground"
                            title={p.slug}
                          >
                            {p.slug}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {traffic ? (
                        <HealthBadge status={traffic.status} />
                      ) : (
                        <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                          No traffic
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.accounts ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {traffic ? (
                        <HealthTimeline entry={traffic} className="gap-[2px] [&>li]:h-3" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No traffic</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {traffic ? formatCount(traffic.requests) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {traffic ? `${traffic.successRate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {traffic && traffic.p95Ms > 0 ? formatMs(traffic.p95Ms) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}
