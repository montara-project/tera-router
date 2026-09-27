import { IconDownload, IconLock, IconPlus, IconUpload } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type {
  GuardrailPolicy,
  GuardrailsOverview,
  GuardrailsScope,
} from '@/lib/api/models/guardrails'

import SectionCard from '@/components/block/common/section-card'
import AuditList from '@/components/block/guardrails/audit-list'
import EditPolicyDialog, {
  defaultGuardrailsConfig,
} from '@/components/block/guardrails/edit-policy-dialog'
import GuardrailsTabs, { GUARDRAILS_TABS } from '@/components/block/guardrails/guardrails-tabs'
import PolicyRow from '@/components/block/guardrails/policy-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { guardrailsQueries } from '@/lib/api/queries/guardrails'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(safety)/guardrails/')({
  component: RouteComponent,
})

const PRIMARY_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90'

const NEW_POLICY_BUTTON_CLASS =
  'bg-amber-600 text-white hover:bg-amber-500/90 dark:bg-amber-600 dark:hover:bg-amber-500/90'

const SCOPE_HINTS: Record<GuardrailsScope, string> = {
  global: 'Master policy that applies to every request when no more specific policy fires.',
  provider: 'Per-provider overrides (OpenAI, Anthropic, Gemini, ...).',
  model: 'Policies scoped to a model apply only to that model, overriding provider and global.',
  chain:
    'Policies scoped to a chain apply at every hop of the chain, overriding model-level rules.',
  key: 'Policies scoped to an API key apply to that credential only, overriding everything upstream.',
}

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>

        <div className="mt-4 flex gap-2">
          {GUARDRAILS_TABS.map((tab) => (
            <Skeleton key={tab.value} className="h-9 w-24 rounded-lg" />
          ))}
        </div>

        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
        <Skeleton className="mt-4 h-4 w-80 rounded-lg" />
        <Skeleton className="mt-4 h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}

function ExternalDetectorsCard({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Card className="bg-background">
      <CardContent className="flex items-start gap-4 p-4 sm:p-5">
        <IconLock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Allow external detector engines</p>
          <p className="text-muted-foreground mt-1 text-sm">
            When off, every policy is forced back to its native engine — OpenAI Moderation,
            Microsoft Presidio, and embedding-based topic matching are disabled tenant-wide. Use
            this for GDPR / data-residency setups where prompt content must never leave the Tera
            Router process.
          </p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Allow external detector engines"
          className="data-[state=checked]:bg-amber-600"
        />
      </CardContent>
    </Card>
  )
}

function GuardrailsContent({ initial }: { initial: GuardrailsOverview }) {
  const [tab, setTab] = useState<GuardrailsScope | 'audit'>('global')
  const [overview, setOverview] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPolicy, setDraftPolicy] = useState<GuardrailPolicy | null>(null)

  const policies = overview.policies.filter((policy) => policy.scope === tab)
  const editingPolicy = overview.policies.find((policy) => policy.id === editingId) ?? null
  const dialogPolicy = editingPolicy ?? draftPolicy
  const dialogMode = editingPolicy ? 'edit' : 'create'

  const handleImport = () => {
    toast.info('Policy import is not wired to the backend yet')
  }

  const handleExportAll = () => {
    toast.info('Policy export is not wired to the backend yet')
  }

  const handleDelete = (name: string) => {
    toast.info(`Deleting ${name} is not wired to the backend yet`)
  }

  const handleNewPolicy = (scope: GuardrailsScope) => {
    setDraftPolicy({
      id: crypto.randomUUID(),
      name: '',
      enabled: true,
      scope,
      protections: [],
      config: defaultGuardrailsConfig(),
    })
  }

  const handleDialogClose = () => {
    setEditingId(null)
    setDraftPolicy(null)
  }

  const handleSavePolicy = (updated: GuardrailPolicy) => {
    setOverview((current) => {
      const exists = current.policies.some((policy) => policy.id === updated.id)

      return {
        ...current,
        policies: exists
          ? current.policies.map((policy) => (policy.id === updated.id ? updated : policy))
          : [...current.policies, updated],
      }
    })
    handleDialogClose()
    toast.success(editingPolicy ? 'Policy saved' : 'Policy created')
  }

  const handleToggleDetectors = (checked: boolean) => {
    setOverview((current) => ({ ...current, externalDetectors: checked }))
    services.guardrails.updateExternalDetectors(checked)
  }

  const handleTogglePolicy = (id: string, enabled: boolean) => {
    setOverview((current) => ({
      ...current,
      policies: current.policies.map((policy) =>
        policy.id === id ? { ...policy, enabled } : policy
      ),
    }))
  }

  return (
    <>
      <SectionCard
        title="Guardrails"
        description="Content-safety policies layered global → provider → model → chain → API key. Most specific wins."
        toolbar={
          <>
            <Button className={PRIMARY_BUTTON_CLASS} onClick={handleImport}>
              <IconUpload />
              <span>Import</span>
            </Button>
            <Button className={PRIMARY_BUTTON_CLASS} onClick={handleExportAll}>
              <IconDownload />
              <span>Export all</span>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <GuardrailsTabs value={tab} onChange={setTab} />

          {tab === 'audit' ? (
            <AuditList entries={overview.audit} />
          ) : (
            <div className="space-y-4">
              {tab === 'global' && (
                <ExternalDetectorsCard
                  checked={overview.externalDetectors}
                  onCheckedChange={handleToggleDetectors}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">{SCOPE_HINTS[tab]}</p>
                {tab !== 'global' && (
                  <Button className={NEW_POLICY_BUTTON_CLASS} onClick={() => handleNewPolicy(tab)}>
                    <IconPlus />
                    <span>New Policy</span>
                  </Button>
                )}
              </div>

              {policies.length > 0 ? (
                policies.map((policy) => (
                  <PolicyRow
                    key={policy.id}
                    policy={policy}
                    onToggle={(enabled) => handleTogglePolicy(policy.id, enabled)}
                    onEdit={() => setEditingId(policy.id)}
                    onDelete={() => handleDelete(policy.name)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <IconLock className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No {tab} policies yet</p>
                    <p className="text-muted-foreground text-sm">
                      Add a policy to override the global config for this scope.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <EditPolicyDialog
        policy={dialogPolicy}
        mode={dialogMode}
        onOpenChange={(open) => {
          if (!open) handleDialogClose()
        }}
        onSave={handleSavePolicy}
      />
    </>
  )
}

function RouteComponent() {
  const { data } = useQuery(guardrailsQueries.overview())

  if (!data) {
    return <RouteSkeleton />
  }

  return <GuardrailsContent initial={data} />
}
