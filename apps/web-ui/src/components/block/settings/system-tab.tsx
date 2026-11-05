import {
  IconAlertTriangle,
  IconArrowUpCircle,
  IconExternalLink,
  IconRefresh,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'

import { SettingsSection } from '@/components/block/settings/setting-row'
import { Button } from '@/components/ui/button'
import { compareVersions, systemQueries } from '@/lib/api/queries/system'
import { cn } from '@/lib/utils'

type CheckState = 'idle' | 'checking' | 'error' | 'unknown-current' | 'up-to-date' | 'available'

/** "v0.4.1" / "0.4.1" -> "0.4.1"; non-semver values (e.g. "dev") -> undefined */
function normalizeVersion(value: string | undefined): string | undefined {
  const match = value?.trim().match(/^v?(\d+(?:\.\d+){0,2})$/)
  return match?.[1]
}

function displayVersion(value: string | undefined): string {
  if (!value) return '—'
  const normalized = normalizeVersion(value)
  return normalized ? `v${normalized}` : value
}

function resolveCheckState(
  isPending: boolean,
  isError: boolean,
  hasLatest: boolean,
  current: string | undefined,
  latest: string | undefined
): CheckState {
  if (isPending) return 'checking'
  if (isError) return 'error'
  if (!hasLatest) return 'idle'
  if (!current || !latest) return 'unknown-current'
  return compareVersions(current, latest) >= 0 ? 'up-to-date' : 'available'
}

const BADGES: Record<CheckState, { className: string; label: string }> = {
  idle: { className: 'bg-muted text-muted-foreground', label: 'Not checked' },
  checking: { className: 'bg-muted text-muted-foreground', label: 'Checking…' },
  error: { className: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'Check failed' },
  'unknown-current': { className: 'bg-muted text-muted-foreground', label: 'Development build' },
  'up-to-date': {
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Up to date',
  },
  available: {
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'Update available',
  },
}

interface SystemTabProps {
  version: string | undefined
}

export default function SystemTab({ version }: SystemTabProps) {
  const checkMutation = useMutation(systemQueries.checkLatestRelease())

  const current = normalizeVersion(version)
  const latest = normalizeVersion(checkMutation.data?.tag)
  const state = resolveCheckState(
    checkMutation.isPending,
    checkMutation.isError,
    Boolean(checkMutation.data),
    current,
    latest
  )

  const badge = BADGES[state]
  const badgeIcon = state === 'error' ? <IconAlertTriangle className="size-3" /> : null

  const cell = 'flex flex-col gap-1 bg-card px-4 py-3'

  return (
    <SettingsSection
      icon={IconArrowUpCircle}
      title="Updates"
      aside={
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={checkMutation.isPending}
          onClick={() => checkMutation.mutate()}
        >
          <IconRefresh
            className={cn('size-4', checkMutation.isPending && 'motion-safe:animate-spin')}
          />
          Check now
        </Button>
      }
    >
      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <div className={cell}>
          <dt className="text-xs text-muted-foreground">Current</dt>
          <dd className="font-mono text-[15px] font-semibold">{displayVersion(version)}</dd>
        </div>
        <div className={cell}>
          <dt className="text-xs text-muted-foreground">Latest</dt>
          <dd className="font-mono text-[15px] font-semibold">
            {displayVersion(checkMutation.data?.tag)}
          </dd>
          {checkMutation.data ? null : (
            <dd className="text-xs text-muted-foreground">Check to see the newest release</dd>
          )}
        </div>
        <div className={cell}>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd>
            {state === 'available' ? (
              <a
                href={checkMutation.data?.url}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11.5px] font-medium hover:underline',
                  badge.className
                )}
              >
                {badgeIcon}
                {badge.label}
                <IconExternalLink className="size-3" />
              </a>
            ) : (
              <span
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11.5px] font-medium',
                  badge.className
                )}
              >
                {badgeIcon}
                {badge.label}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </SettingsSection>
  )
}
