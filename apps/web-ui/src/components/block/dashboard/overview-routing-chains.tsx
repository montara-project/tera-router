import { IconStack2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Fragment } from 'react'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export default function OverviewRoutingChains() {
  // The server keeps the enabled chains and attaches each one's 24h health.
  const chainsQuery = useQuery(queries.chains.list({ enabled: true, health_window: '24h' }))
  const chains = chainsQuery.data?.data ?? []

  return (
    <SectionCardPanel
      title="Routing chains"
      icon={IconStack2}
      action={{ label: 'Manage chains', to: '/chains' }}
    >
      <div className="scrollbar-seamless flex max-h-[28rem] flex-col gap-5 overflow-y-auto overscroll-contain p-4">
        {chainsQuery.isLoading && <Skeleton className="h-20 w-full rounded-md" />}
        {!chainsQuery.isLoading && chains.length === 0 && (
          <p className="text-muted-foreground text-sm">No routing chains yet.</p>
        )}
        {chains.map((chain) => {
          const stat = chain.health
          const served = new Map((stat?.served ?? []).map((s) => [s.model, s.requests]))
          const servedTotal = [...served.values()].reduce((a, b) => a + b, 0)
          const steps = chain.steps.filter((s) => s.active).sort((a, b) => a.position - b.position)

          return (
            <div key={chain.id} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-mono text-[13px] font-medium" title={chain.name}>
                  {chain.name}
                </span>
                <span className="text-muted-foreground inline-block rounded-sm border border-border px-1.5 py-0.5 text-[11px] first-letter:uppercase">
                  {chain.strategy.replaceAll('_', ' ')}
                </span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {stat?.requests ?? 0} req ·{' '}
                  <span className="text-foreground font-medium">
                    {(stat?.fallbackRate ?? 0).toFixed(1)}%
                  </span>{' '}
                  fell back
                </span>
              </div>
              <div
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`${(stat?.successRate ?? 0).toFixed(1)}% of attempts succeeded in the last 24 hours`}
              >
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${stat?.successRate ?? 0}%` }}
                />
              </div>
              <ol
                className="flex flex-wrap items-center gap-1.5"
                aria-label={`${chain.name} steps`}
              >
                {steps.map((step, i) => {
                  const share =
                    servedTotal > 0 ? ((served.get(step.model) ?? 0) / servedTotal) * 100 : 0
                  return (
                    <Fragment key={step.id}>
                      {i > 0 && (
                        <span className="text-muted-foreground text-xs" aria-hidden>
                          →
                        </span>
                      )}
                      <li className="flex min-w-0 items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[11px]">
                        <span
                          className="bg-primary size-1.5 shrink-0 rounded-full"
                          style={{ opacity: Math.max(share / 100, 0.25) }}
                          aria-hidden
                        />
                        <span className="truncate" title={`${step.provider}/${step.model}`}>
                          {step.model}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {share.toFixed(1)}%
                        </span>
                      </li>
                    </Fragment>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </div>
    </SectionCardPanel>
  )
}
