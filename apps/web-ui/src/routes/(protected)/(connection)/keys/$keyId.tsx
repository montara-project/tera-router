import { IconArrowLeft, IconKey } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import SectionCard from '@/components/block/common/section-card'
import KeyActionsMenu from '@/components/block/keys/key-actions-menu'
import KeyGeneralTab, { KeyStatusBadge } from '@/components/block/keys/key-general-tab'
import KeyGuardrailsTab from '@/components/block/keys/key-guardrails-tab'
import KeyModelsTab from '@/components/block/keys/key-models-tab'
import KeySkillsTab from '@/components/block/keys/key-skills-tab'
import PortalLinkButton from '@/components/block/keys/portal-link-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { queries } from '@/lib/api/queries'
import { formatDate } from '@/lib/date'

export const Route = createFileRoute('/(protected)/(connection)/keys/$keyId')({
  component: KeyDetailRoute,
})

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'models', label: 'Models' },
  { value: 'skills', label: 'Skills' },
  { value: 'guardrails', label: 'Guardrails' },
] as const

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

function KeyDetailRoute() {
  const { keyId } = useParams({ from: '/(protected)/(connection)/keys/$keyId' })
  const [tab, setTab] = useState<string>('overview')
  const navigate = useNavigate()

  const keyQuery = useQuery(queries.keys.get(keyId))
  const key = keyQuery.data

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

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[13px]">
          <li>
            <Link
              to="/keys"
              className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <IconKey className="size-3.5" aria-hidden />
              API keys
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground/70">
            /
          </li>
          <li aria-current="page" className="truncate">
            {key.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* Same tile as PageHeader (common/page-header.tsx). */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary/10 text-primary">
            <IconKey className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{key.name}</h1>
              <KeyStatusBadge status={key.status} />
            </div>
            <p className="text-[13px] text-muted-foreground">
              <code className="font-mono text-[12.5px]">{key.key_preview}</code>
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              {key.plan_label}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              Created {formatDate(key.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PortalLinkButton apiKey={key} />
          <KeyActionsMenu
            record={key}
            triggerClassName="size-9"
            onRevoked={() => void navigate({ to: '/keys' })}
          />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" size="md" className="w-full justify-start gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="px-3 data-[state=active]:text-foreground"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <KeyGeneralTab apiKey={key} />
        </TabsContent>

        <TabsContent value="models" className="mt-5">
          <KeyModelsTab apiKey={key} />
        </TabsContent>

        <TabsContent value="skills" className="mt-5">
          <KeySkillsTab apiKey={key} />
        </TabsContent>

        <TabsContent value="guardrails" className="mt-5">
          <KeyGuardrailsTab apiKey={key} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
