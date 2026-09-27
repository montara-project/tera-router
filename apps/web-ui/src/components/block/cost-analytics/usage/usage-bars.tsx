import { IconAlertTriangle, IconChevronDown, IconDownload, IconScissors } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { fmtCompact, fmtKb } from './format'

export function QualityBar({ quality }: { quality: UsageTelemetryOverview['quality'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border-amber-600/30 bg-amber-50 dark:border-amber-600/30 dark:bg-amber-950/20">
      <CardContent className="p-0">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
        >
          <IconAlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Accounting quality</p>
            <p className="text-muted-foreground text-xs">
              {quality.notes} audit notes · expand for provenance
            </p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="rounded-lg border border-amber-600/30 bg-card px-3 py-1.5 text-center">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Requests</p>
              <p className="text-xs font-semibold text-foreground">{quality.requestsCoverage}%</p>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-card px-3 py-1.5 text-center">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Tokens</p>
              <p className="text-xs font-semibold text-foreground">{quality.tokensCoverage}%</p>
            </div>
          </div>

          <IconChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {expanded ? (
          <div className="border-t border-amber-600/20 px-4 py-3">
            <ul className="text-muted-foreground space-y-1.5 text-xs">
              <li>
                · 36 requests carry estimated pricing (pricing est.) instead of recorded cost.
              </li>
              <li>
                · 7 requests were attributed via usage estimates and may drift from provider bills.
              </li>
              <li>· Terminal requests without a pricing key are excluded from spend totals.</li>
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function OptimizationBar({
  optimization,
}: {
  optimization: UsageTelemetryOverview['optimization']
}) {
  const handleSavingsCard = () => {
    toast.info('Savings card export is not wired to the backend yet')
  }

  const stats = [
    { value: optimization.savedLabel, label: 'saved' },
    { value: fmtCompact(optimization.tokensSaved), label: 'tokens' },
    { value: `${optimization.optimizedRequests}`, label: 'optimized' },
    { value: fmtKb(optimization.promptReducedBytes), label: 'prompt reduced' },
  ]

  return (
    <Card className="bg-background">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
          <IconScissors className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Optimization</p>
          <p className="text-muted-foreground text-xs">Open rules and client attribution</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 lg:ml-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-foreground">{stat.value}</span>
              <span className="text-muted-foreground text-xs">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90"
            onClick={handleSavingsCard}
          >
            <span>Savings Card</span>
            <IconDownload />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
