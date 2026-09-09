import { Activity, DollarSign, ShieldCheck } from 'lucide-react'

import UsageCard from '../common/usage-card'

export default function UsageOverviewSection() {
  return (
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
  )
}
