import {
  IconArrowLeft,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
  IconTerminal2,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import ClaudeCodeConfig from '@/components/block/cli-tools/claude-code-config'
import CopyableButton from '@/components/block/common/copyable-button'
import { Icons } from '@/components/block/common/icons'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

const INSTALL_COMMANDS = [
  {
    label: 'Native installer (macOS, Linux, WSL)',
    command: 'curl -fsSL https://claude.ai/install.sh | bash',
  },
  { label: 'npm (Node.js 18+)', command: 'npm install -g @anthropic-ai/claude-code' },
] as const

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-5 w-32 rounded-md" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export default function ClaudeCodeDetail() {
  const statusQuery = useQuery(queries.cliTools.claudeCode())
  const keysQuery = useQuery(queries.keys.list({ limit: 100 }))

  if (statusQuery.isLoading || keysQuery.isLoading) return <DetailSkeleton />

  const status = statusQuery.data
  const error = statusQuery.error ?? keysQuery.error
  if (error || !status) {
    return (
      <SectionCard
        title="Couldn't load Claude Code status"
        description={error ? axiosErrorMessage(error) : undefined}
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void Promise.all([statusQuery.refetch(), keysQuery.refetch()])}
          >
            Retry
          </Button>
          <Button asChild variant="ghost">
            <Link to="/cli-tools">
              <IconArrowLeft />
              Back to CLI Tools
            </Link>
          </Button>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/cli-tools" className={BACK_LINK_CLASS}>
        <IconArrowLeft className="h-4 w-4" />
        Back to CLI Tools
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#d97757] text-white">
          <Icons.claude className="size-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Claude Code</h1>
            {status.installed ? (
              <Badge variant="success" appearance="light" size="sm" title={status.binary_path}>
                <IconCircleCheck />
                Installed
              </Badge>
            ) : (
              <Badge variant="secondary" appearance="light" size="sm">
                <IconInfoCircle />
                Not installed
              </Badge>
            )}
            {status.version && (
              <span className="text-muted-foreground font-mono text-xs">{status.version}</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Anthropic's CLI coding agent</p>
        </div>
      </div>

      {!status.installed && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30"
        >
          <IconCircleX
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Claude Code CLI not detected locally
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              You can still copy the config snippet below, or install the CLI first.
            </p>
            <Collapsible>
              <CollapsibleTrigger className="group mt-2 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-amber-700 hover:underline focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:text-amber-400">
                <IconChevronDown
                  aria-hidden
                  className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
                How to install
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                {INSTALL_COMMANDS.map((item) => (
                  <div key={item.command} className="space-y-1">
                    <p className="text-muted-foreground text-[11px]">{item.label}</p>
                    <div className="bg-background/60 rounded-md border px-3 py-2">
                      <CopyableButton value={item.command} sorted={false} size="sm" />
                    </div>
                  </div>
                ))}
                <p className="text-muted-foreground text-[11px]">
                  Install on the machine running Tera Router, then reload this page.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )}

      <ClaudeCodeConfig status={status} apiKeys={keysQuery.data?.data ?? []} />

      <Card className="bg-background">
        <div className="space-y-1 px-5 py-4">
          <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            <IconTerminal2 aria-hidden className="size-4 shrink-0" />
            Config path:
            <span className="text-foreground/80 truncate font-mono" title={status.config_path}>
              {status.config_path}
            </span>
            {!status.config_exists && <span>(created on Apply)</span>}
          </p>
          {status.config_error && (
            <p role="alert" className="text-destructive text-xs">
              {status.config_error} — fix or remove it before applying.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
