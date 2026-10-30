import { IconActivity, IconCircleDot, IconServer } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { formatUsd } from '@/lib/currency'
import { formatCompact } from '@/lib/format'

import QuotaSummaryCard from './quota-summary-card'

interface QuotaSummarySectionProps {
  summary: Models.QuotaSummary
}

export default function QuotaSummarySection({ summary }: QuotaSummarySectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <QuotaSummaryCard
        icon={IconServer}
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
        icon={IconActivity}
        iconTone="amber"
        label="Period Usage"
        stats={[
          { value: formatCompact(summary.input_tokens), label: 'Input' },
          { value: formatCompact(summary.output_tokens), label: 'Output' },
          { value: formatUsd(summary.attributed_cost), label: 'Attributed cost' },
        ]}
        value={summary.requests}
        valueLabel="requests"
      />

      <QuotaSummaryCard
        icon={IconCircleDot}
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
