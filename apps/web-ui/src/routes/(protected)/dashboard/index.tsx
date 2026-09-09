import { createFileRoute } from '@tanstack/react-router'
import { Activity, DollarSign, ShieldCheck } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import SimpleButtonGroup, {
  type SimpleButtonGroupItem,
} from '@/components/block/common/simple-button-group'
import UsageCard from '@/components/block/common/usage-card'

export const Route = createFileRoute('/(protected)/dashboard/')({
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
      title="Overview"
      description="A concise view of traffic, spend, and routing performance."
      toolbar={
        <SimpleButtonGroup
          defaultValue="7d"
          onValueChange={(value) => console.log(value)}
          items={OVERVIEW_TIME_RANGE}
        />
      }
    >
      <div className="space-y-6 pb-12">
        <div className="grid gap-4 lg:grid-cols-3">
          <UsageCard
            icon={Activity}
            title="Traffic"
            primary="1,234"
            primaryLabel="requests"
            tone="warning"
            items={[
              { label: 'Input', value: '100', tone: 'neutral' },
              { label: 'Output', value: '200', tone: 'neutral' },
              { label: 'Cache read', value: '300', tone: 'neutral' },
            ]}
          />
          <UsageCard
            icon={DollarSign}
            title="Spend & value"
            primary="$1,234"
            primaryLabel="tracked cost"
            tone="accent"
            items={[
              { label: 'Value saved', value: '$567', tone: 'good' },
              { label: 'Cost / request', value: '$1.23', tone: 'neutral' },
              { label: 'Pricing coverage', value: '95%', tone: 'neutral' },
            ]}
          />
          <UsageCard
            icon={ShieldCheck}
            title="Reliability"
            primary="98.5%"
            primaryLabel="successful"
            tone="success"
            items={[
              {
                label: 'Failed',
                value: '12',
                tone: 'danger',
              },
              { label: 'Avg latency', value: '150ms', tone: 'neutral' },
              { label: 'TTFT', value: '200ms', tone: 'neutral' },
            ]}
          />
        </div>
      </div>
    </SectionCard>
  )
}
