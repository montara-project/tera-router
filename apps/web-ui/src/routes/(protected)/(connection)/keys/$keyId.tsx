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
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import KeyGeneralTab, { KeyStatusBadge } from '@/components/block/keys/key-general-tab'
import KeyGuardrailsTab from '@/components/block/keys/key-guardrails-tab'
import KeyModelsTab from '@/components/block/keys/key-models-tab'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'

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
  const [tab, setTab] = useState<string>('general')
  const [revealed, setRevealed] = useState<string | null>(null)
  const { copied, copy } = useCopyToClipboard()

  const keyQuery = useQuery(queries.keys.get(keyId))
  const key = keyQuery.data

  const revealMutation = useMutation(queries.keys.reveal())

  // The masked preview is all GET returns, so copying the real credential goes
  // through the audit-logged reveal endpoint first.
  const handleCopy = async () => {
    let value = revealed
    if (!value) {
      try {
        const res = await revealMutation.mutateAsync(keyId)
        value = res.data.full_key
        setRevealed(value)
      } catch (error) {
        toast.error(axiosErrorMessage(error as Error))
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
      const res = await revealMutation.mutateAsync(keyId)
      setRevealed(res.data.full_key)
    } catch (error) {
      toast.error(axiosErrorMessage(error as Error))
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
              <code
                key={revealed ? 'revealed' : 'masked'}
                className="text-muted-foreground animate-in fade-in-0 font-mono text-sm duration-200"
              >
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
                <span className="grid *:col-start-1 *:row-start-1">
                  <IconEye
                    className={cn('transition-all duration-200', revealed && 'scale-50 opacity-0')}
                  />
                  <IconEyeOff
                    className={cn('transition-all duration-200', !revealed && 'scale-50 opacity-0')}
                  />
                </span>
              </Button>
              <Button
                aria-label={`Copy ${key.name} key`}
                className="text-muted-foreground hover:text-foreground"
                mode="icon"
                onClick={handleCopy}
                size="xs"
                variant="ghost"
              >
                <span className="grid *:col-start-1 *:row-start-1">
                  <IconCopy
                    className={cn('transition-all duration-200', copied && 'scale-50 opacity-0')}
                  />
                  <IconCheck
                    className={cn(
                      'text-emerald-600 transition-all duration-200 dark:text-emerald-300',
                      !copied && 'scale-50 opacity-0'
                    )}
                  />
                </span>
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
          <KeyGeneralTab apiKey={key} />
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
