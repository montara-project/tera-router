import {
  IconAlertTriangle,
  IconArrowUpCircle,
  IconExternalLink,
  IconRefresh,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
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
  error: { className: 'bg-red-950 text-red-400', label: 'Check failed' },
  'unknown-current': { className: 'bg-muted text-muted-foreground', label: 'Development build' },
  'up-to-date': { className: 'bg-emerald-950 text-emerald-400', label: 'Up to date' },
  available: { className: 'bg-amber-950 text-amber-400', label: 'Update available' },
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
  const badgeIcon =
    state === 'error' ? (
      <IconAlertTriangle className="h-3.5 w-3.5" />
    ) : (
      <IconArrowUpCircle className="h-3.5 w-3.5" />
    )

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <IconBadge
              icon={IconArrowUpCircle}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Updates</CardTitle>
              <CardDescription>
                Check for new Tera Router releases and read the latest changelog.
              </CardDescription>
            </CardHeading>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={checkMutation.isPending}
            onClick={() => checkMutation.mutate()}
          >
            <IconRefresh className={cn('h-4 w-4', checkMutation.isPending && 'animate-spin')} />
            Check now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div className="flex items-center gap-10">
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Current
              </p>
              <p className="text-foreground mt-0.5 font-mono text-lg">{displayVersion(version)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Latest
              </p>
              <p className="text-foreground mt-0.5 font-mono text-lg">
                {displayVersion(checkMutation.data?.tag)}
              </p>
            </div>
          </div>

          {state === 'available' ? (
            <a
              href={checkMutation.data?.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90',
                badge.className
              )}
            >
              {badgeIcon}
              {badge.label}
              <IconExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold',
                badge.className
              )}
            >
              {badgeIcon}
              {badge.label}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
