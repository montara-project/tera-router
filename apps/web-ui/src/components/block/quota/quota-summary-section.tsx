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
        value={summary.activeAccounts}
        valueLabel={`of ${summary.totalAccounts} active`}
      />

      <QuotaSummaryCard
        icon={Activity}
        iconTone="amber"
        label="Period Usage"
        stats={[
          { value: formatCompactNumber(summary.inputTokens), label: 'Input' },
          { value: formatCompactNumber(summary.outputTokens), label: 'Output' },
          { value: formatCost(summary.attributedCost), label: 'Attributed cost' },
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
          { value: summary.quotaCapable, label: 'Quota-capable' },
          { value: summary.usageOnly, label: 'Usage only' },
          { value: summary.notReported, label: 'Not reported' },
        ]}
        value={summary.accountsReporting}
        valueLabel="accounts reporting"
      />
    </div>
  )
}
