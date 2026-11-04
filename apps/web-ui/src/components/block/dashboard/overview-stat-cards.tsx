import { IconBolt, IconClock, IconCurrencyDollar, IconShieldCheck } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import StatCardGrid, {
  change,
  relative,
  type StatCard,
} from '@/components/block/dashboard/stat-card-grid'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCount, formatMs } from '@/lib/format'

export default function OverviewStatCards({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const { traffic, performance, spend, previous, trend } = telemetry
  const hasPrevious = previous.requests > 0

  const cards: StatCard[] = [
    {
      label: 'Requests',
      icon: IconBolt,
      value: formatCount(traffic.requests),
      series: trend.map((p) => p.requests),
      delta: change(
        traffic.requests,
        previous.requests,
        hasPrevious,
        relative(traffic.requests, previous.requests),
        'up'
      ),
    },
    {
      label: 'Success rate',
      icon: IconShieldCheck,
      value: `${performance.successRate.toFixed(2)}%`,
      series: trend.map((p) => (p.requests > 0 ? (p.requests - p.failures) / p.requests : 0)),
      delta: change(
        performance.successRate,
        previous.successRate,
        hasPrevious,
        (diff) => `${diff.toFixed(1)} pts`,
        'up'
      ),
    },
    {
      label: 'Latency p50',
      icon: IconClock,
      value: formatMs(performance.p50Ms),
      detail: `p95 ${formatMs(performance.p95Ms)}`,
      series: trend.map((p) => p.latencyMs),
      delta: change(performance.p50Ms, previous.p50Ms, hasPrevious, formatMs, 'down'),
    },
    {
      label: 'Spend',
      icon: IconCurrencyDollar,
      value: formatMicrosUsd(spend.costMicros),
      series: trend.map((p) => p.costMicros),
      delta: change(
        spend.costMicros,
        previous.costMicros,
        hasPrevious && previous.costMicros > 0,
        relative(spend.costMicros, previous.costMicros),
        'down'
      ),
    },
  ]

  return <StatCardGrid cards={cards} />
}
