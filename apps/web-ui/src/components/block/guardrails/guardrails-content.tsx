import type { ChangeEvent } from 'react'

import {
  IconChevronDown,
  IconDownload,
  IconListDetails,
  IconPlus,
  IconShield,
  IconTrendingUp,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { PolicyDto } from '@/lib/api/dtos/guardrails/schema'
import type { GuardrailPolicy, GuardrailsOverview } from '@/lib/api/models/guardrails'
import type { UsageRange } from '@/lib/api/models/usage'

import PageHeader from '@/components/block/common/page-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { PolicySchema } from '@/lib/api/dtos/guardrails/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'
import { readJsonObject, saveFile } from '@/lib/file'

import EditPolicyDialog, { defaultGuardrailsConfig } from './edit-policy-dialog'
import GuardrailsAuditLog from './guardrails-audit-log'
import GuardrailsOverviewTab from './guardrails-overview'
import GuardrailsPolicies from './guardrails-policies'

const TABS = [
  { value: 'overview', label: 'Overview', icon: IconTrendingUp },
  { value: 'policies', label: 'Policies', icon: IconShield },
  { value: 'audit', label: 'Audit log', icon: IconListDetails },
]

const EXPORT_FILE_NAME = 'guardrails-policies.json'

/** The create/update body for a policy; also the shape of one exported policy. */
function toPolicyDto(policy: GuardrailPolicy, enabled = policy.enabled): PolicyDto {
  return {
    name: policy.name,
    scope: policy.scope,
    target: policy.target ?? '',
    protections: policy.protections,
    enabled,
    config: policy.config ?? defaultGuardrailsConfig(),
  }
}

export default function GuardrailsContent({ overview }: { overview: GuardrailsOverview }) {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState<UsageRange>('24h')
  const [live, setLive] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPolicy, setDraftPolicy] = useState<GuardrailPolicy | null>(null)

  // The overview query is shared with the route, which uses it for the loading
  // gate; polling it here keeps the audit tab live.
  const overviewQuery = useQuery({
    ...queries.guardrails.overview(),
    refetchInterval: live ? 15_000 : false,
  })
  const decisions = overviewQuery.data?.data.decisions ?? overview.decisions
  const metricsQuery = useQuery(queries.guardrails.metrics(range))

  const createMutation = useMutation(queries.guardrails.create())
  const updateMutation = useMutation(queries.guardrails.update())
  const deleteMutation = useMutation(queries.guardrails.delete())
  const updateSettingsMutation = useMutation(queries.guardrails.updateSettings())
  const importMutation = useMutation(queries.guardrails.importPolicies())
  const importInput = useRef<HTMLInputElement>(null)

  const editingPolicy = overview.policies.find((policy) => policy.id === editingId) ?? null
  const dialogPolicy = editingPolicy ?? draftPolicy
  const dialogMode = editingPolicy ? 'edit' : 'create'

  const handleExportAll = () => {
    const policies = overview.policies.map((policy) => toPolicyDto(policy))
    saveFile(
      new Blob([JSON.stringify({ policies }, null, 2)], { type: 'application/json' }),
      EXPORT_FILE_NAME
    )
    toast.success(`Exported ${policies.length} policies`)
  }

  // Imports are additive: every policy in the file is created alongside the
  // existing ones. The whole file is validated before the first create.
  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const backup = await readJsonObject(file)
      if (!Array.isArray(backup.policies)) {
        throw new Error(`${file.name} has no "policies" list.`)
      }
      const policies = backup.policies.map((policy) => parseDto(PolicySchema, policy))
      importMutation.mutate(policies, {
        onSuccess: (count) => toast.success(`Imported ${count} policies`),
        onError: toastAxiosError,
      })
    } catch (err) {
      toastAxiosError(err)
    }
  }

  const handleNewPolicy = () => {
    setDraftPolicy({
      id: crypto.randomUUID(),
      name: '',
      enabled: true,
      scope: 'global',
      protections: [],
      config: defaultGuardrailsConfig(),
    })
  }

  const handleDialogClose = () => {
    setEditingId(null)
    setDraftPolicy(null)
  }

  const handleSavePolicy = (updated: GuardrailPolicy) => {
    const exists = overview.policies.some((policy) => policy.id === updated.id)
    const reqBody = toPolicyDto(updated)
    const options = {
      onSuccess: () => {
        handleDialogClose()
        toast.success(editingPolicy ? 'Policy saved' : 'Policy created')
      },
      onError: () => toast.error('Failed to save policy'),
    }

    if (exists) {
      updateMutation.mutate({ id: updated.id, reqBody }, options)
    } else {
      createMutation.mutate(reqBody, options)
    }
  }

  const handleToggleDetectors = (checked: boolean) => {
    updateSettingsMutation.mutate(
      { external_detectors: checked },
      {
        onSuccess: () => toast.success('External detector settings saved'),
        onError: () => toast.error('Failed to update external detector settings'),
      }
    )
  }

  const handleTogglePolicy = (id: string, enabled: boolean) => {
    const policy = overview.policies.find((item) => item.id === id)
    if (!policy) {
      toast.error('Policy not found')
      return
    }
    updateMutation.mutate(
      { id, reqBody: toPolicyDto(policy, enabled) },
      { onError: () => toast.error('Failed to update policy') }
    )
  }

  const handleDeletePolicy = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Policy deleted'),
      onError: () => toast.error('Failed to delete policy'),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <PageHeader
        icon={IconShield}
        iconClassName="border-transparent bg-primary/10 text-primary"
        title="Guardrails"
        description="The most specific matching policy wins."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={importMutation.isPending}>
                  Import / export
                  <IconChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => importInput.current?.click()}>
                  <IconUpload />
                  Import policies
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportAll}>
                  <IconDownload />
                  Export all policies
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleNewPolicy}>
              <IconPlus />
              New policy
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" size="md" className="w-full justify-start gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="px-3 text-[13px] data-[state=active]:text-foreground!"
            >
              <item.icon aria-hidden />
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <GuardrailsOverviewTab
            metrics={metricsQuery.data?.data}
            range={range}
            onRangeChange={setRange}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-5">
          <GuardrailsPolicies
            policies={overview.policies}
            externalDetectors={overview.external_detectors}
            onToggleExternalDetectors={handleToggleDetectors}
            onCreate={handleNewPolicy}
            onTogglePolicy={handleTogglePolicy}
            onEdit={setEditingId}
            onDelete={handleDeletePolicy}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-5">
          <GuardrailsAuditLog
            decisions={decisions}
            live={live}
            onLiveChange={setLive}
            refreshing={overviewQuery.isFetching}
            onRefresh={() => void overviewQuery.refetch()}
          />
        </TabsContent>
      </Tabs>

      <EditPolicyDialog
        policy={dialogPolicy}
        mode={dialogMode}
        onOpenChange={(open) => {
          if (!open) handleDialogClose()
        }}
        onSave={handleSavePolicy}
      />
    </div>
  )
}
