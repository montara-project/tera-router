import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'
import SimpleButtonGroup, {
  type SimpleButtonGroupItem,
} from '@/components/block/common/simple-button-group'
import UsageSection from '@/components/block/cost-analytics/usage/usage-section'

export const Route = createFileRoute('/(protected)/(analytics)/usage/')({
  component: RouteComponent,
})

const OVERVIEW_TIME_RANGE: SimpleButtonGroupItem[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '14d', label: '14D' },
  { value: '30d', label: '30D' },
]

function RouteComponent() {
  return (
    <SectionCard
      title="Usage"
      description="Requests, spend, optimization, and provider performance."
      toolbar={
        <SimpleButtonGroup
          defaultValue="7d"
          onValueChange={(value) => console.log(value)}
          items={OVERVIEW_TIME_RANGE}
        />
      }
    >
      <UsageSection />
    </SectionCard>
  )
}
