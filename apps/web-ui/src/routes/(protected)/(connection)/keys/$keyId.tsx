import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconCopy,
  IconCpu,
  IconEye,
  IconEyeOff,
  IconKey,
  IconSettings,
  IconShield,
  IconStack2,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import SectionCard from '@/components/block/common/section-card'
import KeyGuardrailsTab from '@/components/block/keys/key-guardrails-tab'
import KeyModelsTab from '@/components/block/keys/key-models-tab'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { throwAxiosError } from '@/lib/api/axios-error'
import { KEY_QUERY_KEY, keyQueries } from '@/lib/api/queries/key'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(connection)/keys/$keyId')({
  component: KeyDetailRoute,
})

const ACTIVE_TAB_CLASS =
  'data-[state=active]:border-emerald-500! data-[state=active]:text-emerald-400! data-[state=active]:[&_svg]:text-emerald-400!'

const TABS = [
  { value: 'general', label: 'General', icon: IconSettings },
  { value: 'models', label: 'Models', icon: IconCpu },
  { value: 'guardrails', label: 'Guardrails', icon: IconShield },
] as const

function formatDate(iso: string) {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}/${month}/${date.getFullYear()}`
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

  return `${formatDate(iso)}, ${time}`
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-28 rounded-md" />
      <div className="flex items-start gap-3">
        <Skeleton className="size-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

export function KeyStatusBadge({ status }: { status: ApiKeyDetail['status'] }) {
  const variant =
    status === 'active' ? 'success' : status === 'restricted' ? 'warning' : 'secondary'
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Badge variant={variant} appearance="light" size="sm">
      <BadgeDot />
      {label}
    </Badge>
  )
}

function DetailTile({
  label,
  value,
  mono = false,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          {label}
        </p>
        {children ?? (
          <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>
            {value || '—'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function KeyDetailRoute() {
  const { keyId } = useParams({ from: '/(protected)/(connection)/keys/$keyId' })
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<string>('general')
  const [revealed, setRevealed] = useState<string | null>(null)
  const { copied, copy } = useCopyToClipboard()

  const keyQuery = useQuery(keyQueries.get(keyId))
  const key = keyQuery.data

  const toggleMutation = useMutation({
    mutationFn: async (disabled: boolean) => {
      try {
        await services.keys.toggleStatus(keyId, disabled)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: async (_data, disabled) => {
      await queryClient.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
      toast.success(disabled ? 'Key disabled' : 'Key enabled')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'An error occurred'),
  })

  // The masked preview is all GET returns, so copying the real credential goes
  // through the audit-logged reveal endpoint first.
  const handleCopy = async () => {
    let value = revealed
    if (!value) {
      try {
        const res = await services.keys.reveal(keyId)
        value = res.data.data.full_key
        setRevealed(value)
      } catch (error) {
        throwAxiosError(error as Error)
        toast.error('Failed to reveal key')
        return
      }
    }
    copy(value)
  }

  const handleToggleReveal = async () => {
    if (revealed) {
      setRevealed(null)
      return
    }
    try {
      const res = await services.keys.reveal(keyId)
      setRevealed(res.data.data.full_key)
    } catch (error) {
      throwAxiosError(error as Error)
      toast.error('Failed to reveal key')
    }
  }

  if (keyQuery.isLoading) return <DetailSkeleton />

  if (keyQuery.isError || !key) {
    return (
      <SectionCard
        title="API key not found"
        description="This key may have been deleted or belongs to another workspace."
      >
        <Button asChild variant="outline">
          <Link to="/keys">
            <IconArrowLeft />
            Back to API keys
          </Link>
        </Button>
      </SectionCard>
    )
  }

  const active = key.status === 'active'

  return (
    <div className="space-y-4">
      <Link
        to="/keys"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <IconArrowLeft className="h-4 w-4" />
        API keys
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="bg-amber-100 text-amber-700 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60 flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1">
            <IconKey className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{key.name}</h1>
              <KeyStatusBadge status={key.status} />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <code className="text-muted-foreground font-mono text-sm">
                {revealed ?? key.key_preview}
              </code>
              <Button
                aria-label={revealed ? 'Hide key' : 'Reveal key'}
                className="text-muted-foreground hover:text-foreground"
                mode="icon"
                onClick={handleToggleReveal}
                size="xs"
                variant="ghost"
              >
                {revealed ? <IconEyeOff /> : <IconEye />}
              </Button>
              <Button
                aria-label={`Copy ${key.name} key`}
                className="text-muted-foreground hover:text-foreground"
                mode="icon"
                onClick={handleCopy}
                size="xs"
                variant="ghost"
              >
                {copied ? (
                  <IconCheck className="text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <IconCopy />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-5 text-sm">
          <span className="inline-flex items-center gap-2">
            <IconStack2 className="h-4 w-4" />
            {key.plan_label}
          </span>
          <span className="inline-flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Created {formatDate(key.created_at)}
          </span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" size="lg" className="w-full justify-start">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className={ACTIVE_TAB_CLASS}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="bg-card">
            <CardHeader>
              <CardHeading>
                <CardTitle>Key overview</CardTitle>
                <CardDescription>
                  Identity, assignment, and authentication status for this key.
                </CardDescription>
              </CardHeading>
              <CardToolbar>
                <Button
                  className={
                    active
                      ? 'text-destructive hover:text-destructive'
                      : 'text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
                  }
                  disabled={toggleMutation.isPending}
                  variant="outline"
                  onClick={() => toggleMutation.mutate(active)}
                >
                  {active ? 'Disable key' : 'Enable key'}
                </Button>
              </CardToolbar>
            </CardHeader>

            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailTile label="Name" value={key.name} />
                <DetailTile label="Status">
                  <div className="mt-2">
                    <KeyStatusBadge status={key.status} />
                  </div>
                </DetailTile>
                <DetailTile label="Plan" value={key.plan_label} />
                <DetailTile label="Key identifier" value={key.key_preview} mono />
                <DetailTile label="Internal ID" value={key.id} mono />
                <DetailTile label="Created" value={formatDateTime(key.created_at)} />
              </div>

              <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span>
                  Last used{' '}
                  <span className="text-foreground">
                    {key.last_used_at ? formatDateTime(key.last_used_at) : 'Never'}
                  </span>
                </span>
                <span>
                  Updated <span className="text-foreground">{formatDateTime(key.updated_at)}</span>
                </span>
                {key.scopes ? (
                  <span>
                    Scopes <span className="text-foreground font-mono">{key.scopes}</span>
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <KeyModelsTab apiKey={key} />
        </TabsContent>

        <TabsContent value="guardrails" className="mt-4">
          <KeyGuardrailsTab apiKey={key} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
