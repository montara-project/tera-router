import { IconRefresh } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { UsageRange } from '@/lib/api/models/usage'

import SectionCard from '@/components/block/common/section-card'
import SimpleButtonGroup, {
  type SimpleButtonGroupItem,
} from '@/components/block/common/simple-button-group'
import UsageOverviewSection from '@/components/block/dashboard/usage-overview-section'
import { Button } from '@/components/ui/button'
import { USAGE_QUERY_KEY } from '@/lib/api/queries/usage'

export const Route = createFileRoute('/(protected)/dashboard/')({
  component: RouteComponent,
})

const OVERVIEW_TIME_RANGE: SimpleButtonGroupItem[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
]

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<UsageRange>('30d')

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [USAGE_QUERY_KEY] })
    toast.success('Overview refreshed')
  }

  return (
    <SectionCard
      title="Overview"
      description="A concise view of traffic, spend, and routing performance."
      toolbar={
        <>
          <SimpleButtonGroup
            items={OVERVIEW_TIME_RANGE}
            defaultValue={range}
            onValueChange={(value) => setRange(value as UsageRange)}
          />
          <Button variant="outline" size="icon" aria-label="Refresh overview" onClick={handleRefresh}>
            <IconRefresh />
          </Button>
        </>
      }
    >
      <UsageOverviewSection range={range} />
    </SectionCard>
  )
}
