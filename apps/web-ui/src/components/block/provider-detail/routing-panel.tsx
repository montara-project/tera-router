import { IconStack2 } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { chainStrategyLabel } from '@/lib/constants/chain'

/** Chains that route through this provider, as a step or as the final fallback. */
export default function RoutingPanel({
  chains,
  loading,
  slug,
}: {
  chains: Models.Chain[]
  loading: boolean
  slug: string
}) {
  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )
    }
    if (chains.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconStack2}
          title="No chains use this provider"
          description={`Chains with a ${slug} step or final fallback appear here.`}
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Chain</th>
              <th className="px-4 py-2 text-left font-medium">Strategy</th>
              <th className="px-4 py-2 text-left font-medium">Used as</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((chain) => {
              const position = chain.steps.findIndex((step) => step.provider === slug)
              const usedAs =
                position >= 0 ? `Step ${position + 1} of ${chain.steps.length}` : 'Final fallback'
              return (
                <tr key={chain.id} className="border-b border-border last:border-0">
                  <td className="max-w-0 px-4 py-2.5">
                    <Link
                      to="/chains/$chainId"
                      params={{ chainId: chain.id }}
                      className="block truncate rounded-sm font-medium hover:underline"
                      title={chain.name}
                    >
                      {chain.name}
                    </Link>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      chain:{chain.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{chainStrategyLabel(chain.strategy)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{usedAs}</td>
                  <td className="px-4 py-2.5">
                    {chain.enabled ? (
                      <span className="rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400">
                        Enabled
                      </span>
                    ) : (
                      <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                        Off
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <DashboardPanel
      icon={IconStack2}
      title={
        <>
          Chains
          <span className="font-normal text-muted-foreground tabular-nums">{chains.length}</span>
        </>
      }
      description="Chains that route through this provider"
    >
      {renderBody()}
    </DashboardPanel>
  )
}
