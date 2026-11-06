import { IconChartBar, IconRefresh } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { UsageRange } from '@/lib/api/models/usage'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import UsageSection from '@/components/block/cost-analytics/usage/usage-section'
import { Button } from '@/components/ui/button'
import { USAGE_QUERY_KEY } from '@/lib/api/queries/usage'

export const Route = createFileRoute('/(protected)/(analytics)/usage/')({
  component: RouteComponent,
})

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const satisfies readonly { value: UsageRange; label: string }[]

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<UsageRange>('today')

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [USAGE_QUERY_KEY] })
    toast.success('Usage data refreshed')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconChartBar}
        title="Usage"
        description="Cost, speed and routing for every request"
        actions={
          <>
            <SegmentedControl
              aria-label="Time range"
              options={RANGES}
              value={range}
              onChange={setRange}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh usage data"
              onClick={handleRefresh}
            >
              <IconRefresh />
            </Button>
          </>
        }
      />
      <UsageSection range={range} />
    </div>
  )
}
