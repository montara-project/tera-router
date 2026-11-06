import { IconCheck, IconCopy, IconLayoutGrid, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { UsageRange } from '@/lib/api/models/usage'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import UsageOverviewSection from '@/components/block/dashboard/usage-overview-section'
import { Button } from '@/components/ui/button'
import { env } from '@/config/env'
import { PROVIDER_HEALTH_QUERY_KEY } from '@/lib/api/queries/provider-health'
import { USAGE_QUERY_KEY } from '@/lib/api/queries/usage'

export const Route = createFileRoute('/(protected)/dashboard/')({
  component: RouteComponent,
})

const RANGES = [
  { value: '24h', label: '24h', span: '24 hours' },
  { value: '7d', label: '7d', span: '7 days' },
  { value: '30d', label: '30d', span: '30 days' },
  { value: '90d', label: '90d', span: '90 days' },
] as const satisfies readonly { value: UsageRange; label: string; span: string }[]

type OverviewRange = (typeof RANGES)[number]['value']

const BASE_URL = `${env.VITE_API_URL.replace(/\/+$/, '')}/v1`

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<OverviewRange>('7d')
  const [copied, setCopied] = useState(false)
  const span = RANGES.find((r) => r.value === range)?.span

  const handleCopy = () => {
    void navigator.clipboard.writeText(BASE_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [USAGE_QUERY_KEY] })
    void queryClient.invalidateQueries({ queryKey: [PROVIDER_HEALTH_QUERY_KEY] })
    toast.success('Overview refreshed')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconLayoutGrid}
        title="Overview"
        description={`Last ${span}, compared with the ${span} before`}
        actions={
          <>
            <div className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border bg-card pr-1 pl-2.5 text-xs">
              <span className="text-muted-foreground shrink-0">Base URL</span>
              <span className="truncate font-mono" title={BASE_URL}>
                {BASE_URL}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={copied ? 'Base URL copied' : 'Copy base URL'}
                onClick={handleCopy}
              >
                {copied ? <IconCheck className="text-emerald-500" /> : <IconCopy />}
              </Button>
            </div>
            <SegmentedControl
              aria-label="Time range"
              options={RANGES}
              value={range}
              onChange={setRange}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh overview"
              onClick={handleRefresh}
            >
              <IconRefresh />
            </Button>
            <Button asChild>
              <Link to="/providers">
                <IconPlus />
                Connect
              </Link>
            </Button>
          </>
        }
      />
      <UsageOverviewSection range={range} />
    </div>
  )
}
