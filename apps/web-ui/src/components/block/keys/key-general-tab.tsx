import {
  IconArrowUpRight,
  IconChartBar,
  IconCheck,
  IconClock,
  IconCoin,
  IconCopy,
  IconGauge,
  IconSettings,
  IconStack2,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime, formatTimeAgo } from '@/lib/date'
import { formatCompact, formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Overview tab: 30-day usage, the plan that limits the key, and its settings. */
export default function KeyGeneralTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const usageQuery = useQuery(queries.keys.usage(apiKey.id))
  const usage = usageQuery.data
  const toggle = useMutation(queries.keys.toggleStatus())
  const idCopy = useCopyToClipboard()

  const handleToggle = async (on: boolean) => {
    try {
      await toggle.mutateAsync({ id: apiKey.id, disabled: !on })
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const figure = (value: string) => (
    <span className="text-xl font-semibold tabular-nums">{usage ? value : '—'}</span>
  )

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="key-usage-title" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <IconChartBar className="text-primary size-4" aria-hidden />
          <div>
            <h2 id="key-usage-title" className="text-[13px] font-semibold">
              Usage
            </h2>
            <p className="text-xs text-muted-foreground">Last {usage?.days ?? 30} days</p>
          </div>
        </div>
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={IconChartBar} label="Requests">
            {figure(formatCount(usage?.requests ?? 0))}
          </Stat>
          <Stat icon={IconCoin} label="Spend">
            {figure(formatMicrosUsd(usage?.cost_micros ?? 0))}
          </Stat>
          <Stat icon={IconStack2} label="Tokens">
            {figure(formatCompact((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)))}
            {usage ? (
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatCompact(usage.prompt_tokens)} in · {formatCompact(usage.completion_tokens)}{' '}
                out
              </span>
            ) : null}
          </Stat>
          <Stat icon={IconClock} label="Last used">
            <span
              className="text-xl font-semibold"
              title={apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : undefined}
            >
              {apiKey.last_used_at ? formatTimeAgo(apiKey.last_used_at) : 'Never'}
            </span>
          </Stat>
        </dl>
      </section>

      <SectionCardPanel icon={IconGauge} title="Limits">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium">Plan</p>
            <p className="text-xs text-muted-foreground">{apiKey.plan_note || 'No plan limits'}</p>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span>{apiKey.plan_label}</span>
            <Link
              to="/plans"
              className="text-primary inline-flex items-center gap-1 rounded-sm text-[12.5px] font-medium hover:underline"
            >
              Manage plans
              <IconArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </SectionCardPanel>

      <SectionCardPanel icon={IconSettings} title="Settings">
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium">Accept requests</p>
              <p className="text-xs text-muted-foreground">
                Off rejects every request with this key.
              </p>
            </div>
            <Switch
              checked={apiKey.status !== 'disabled'}
              disabled={toggle.isPending}
              onCheckedChange={(on) => void handleToggle(on)}
              aria-label="Accept requests"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <p className="text-[13px] font-medium">Internal ID</p>
            <div className="flex min-w-0 items-center gap-1">
              <code className="truncate font-mono text-[12.5px]" title={apiKey.id}>
                {apiKey.id}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={idCopy.copied ? 'Internal ID copied' : 'Copy internal ID'}
                onClick={() => idCopy.copy(apiKey.id)}
              >
                {idCopy.copied ? (
                  <IconCheck className="size-3.5" />
                ) : (
                  <IconCopy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
          {apiKey.scopes ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <p className="text-[13px] font-medium">Scopes</p>
              <code className="font-mono text-[12.5px]">{apiKey.scopes}</code>
            </div>
          ) : null}
        </div>
      </SectionCardPanel>
    </div>
  )
}

const STATUS_STYLE: Record<ApiKeyDetail['status'], string> = {
  active:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400',
  restricted:
    'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25 ring-inset dark:text-amber-400',
  disabled: 'border border-border bg-muted/40 text-muted-foreground',
}

export function KeyStatusBadge({ status }: { status: ApiKeyDetail['status'] }) {
  return (
    <span
      className={cn('rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium', STATUS_STYLE[status])}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
