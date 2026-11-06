import { IconBolt, IconClock, IconCoins, IconCurrencyDollar } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import StatCardGrid, {
  change,
  relative,
  type StatCard,
} from '@/components/block/dashboard/stat-card-grid'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs } from '@/lib/format'

export default function UsageStatCards({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const { traffic, performance, spend, previous, trend } = telemetry
  const hasPrevious = previous.requests > 0
  const tokens = traffic.inputTokens + traffic.outputTokens
  // No successful request means no latency sample: show a dash, not "0 ms".
  const hasLatency = traffic.success > 0
  const ms = (n: number) => (hasLatency && n > 0 ? formatMs(n) : '—')

  const cards: StatCard[] = [
    {
      label: 'Requests',
      icon: IconBolt,
      value: formatCount(traffic.requests),
      detail: `${performance.successRate.toFixed(1)}% success · ${formatCount(traffic.failed)} failed`,
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
      label: 'Spend',
      icon: IconCurrencyDollar,
      value: formatMicrosUsd(spend.costMicros),
      detail: `${formatMicrosUsd(traffic.requests > 0 ? spend.costMicros / traffic.requests : 0)} / request`,
      series: trend.map((p) => p.costMicros),
      delta: change(
        spend.costMicros,
        previous.costMicros,
        hasPrevious && previous.costMicros > 0,
        relative(spend.costMicros, previous.costMicros),
        'down'
      ),
    },
    {
      label: 'Tokens',
      icon: IconCoins,
      value: formatCompact(tokens),
      detail: `${formatCompact(traffic.inputTokens)} in · ${formatCompact(traffic.outputTokens)} out`,
      series: trend.map((p) => p.tokens),
      delta: change(tokens, previous.tokens, hasPrevious, relative(tokens, previous.tokens), 'up'),
    },
    {
      label: 'Latency p50',
      icon: IconClock,
      value: ms(performance.p50Ms),
      detail: `p95 ${ms(performance.p95Ms)} · TTFT ${ms(performance.ttftMs)}`,
      series: trend.map((p) => p.latencyMs),
      delta: change(
        performance.p50Ms,
        previous.p50Ms,
        hasPrevious && hasLatency && previous.p50Ms > 0,
        formatMs,
        'down'
      ),
    },
  ]

  return <StatCardGrid cards={cards} />
}
