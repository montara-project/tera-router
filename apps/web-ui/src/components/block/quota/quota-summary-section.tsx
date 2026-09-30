import { Activity, CircleDot, Server } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import { formatCompactNumber, formatCost } from './quota-formatters'
import QuotaSummaryCard from './quota-summary-card'

interface QuotaSummarySectionProps {
  summary: Models.QuotaSummary
}

export default function QuotaSummarySection({ summary }: QuotaSummarySectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <QuotaSummaryCard
        icon={Server}
        iconTone="emerald"
        label="Routing Accounts"
        stats={[
          { value: summary.paused, label: 'Paused' },
          { value: summary.attention, label: 'Attention' },
          { value: summary.depleted, label: 'Depleted' },
        ]}
        value={summary.active_accounts}
        valueLabel={`of ${summary.total_accounts} active`}
      />

      <QuotaSummaryCard
        icon={Activity}
        iconTone="amber"
        label="Period Usage"
        stats={[
          { value: formatCompactNumber(summary.input_tokens), label: 'Input' },
          { value: formatCompactNumber(summary.output_tokens), label: 'Output' },
          { value: formatCost(summary.attributed_cost), label: 'Attributed cost' },
        ]}
        value={summary.requests}
        valueLabel="requests"
      />

      <QuotaSummaryCard
        icon={CircleDot}
        iconShape="circle"
        iconTone="neutral"
        label="Quota Visibility"
        stats={[
          { value: summary.quota_capable, label: 'Quota-capable' },
          { value: summary.usage_only, label: 'Usage only' },
          { value: summary.not_reported, label: 'Not reported' },
        ]}
        value={summary.accounts_reporting}
        valueLabel="accounts reporting"
      />
    </div>
  )
}
