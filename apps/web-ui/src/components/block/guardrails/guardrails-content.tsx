import type { ChangeEvent } from 'react'

import { IconDownload, IconLock, IconPlus, IconUpload } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { PolicyDto } from '@/lib/api/dtos/guardrails/schema'
import type {
  GuardrailPolicy,
  GuardrailsOverview,
  GuardrailsScope,
} from '@/lib/api/models/guardrails'

import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { toastAxiosError } from '@/lib/api/axios-error'
import { PolicySchema } from '@/lib/api/dtos/guardrails/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'
import { readJsonObject, saveFile } from '@/lib/file'

import AuditList from './audit-list'
import EditPolicyDialog, { defaultGuardrailsConfig } from './edit-policy-dialog'
import ExternalDetectorsCard from './external-detectors-card'
import GuardrailsTabs from './guardrails-tabs'
import PolicyRow from './policy-row'

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
  const [tab, setTab] = useState<GuardrailsScope | 'audit'>('global')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPolicy, setDraftPolicy] = useState<GuardrailPolicy | null>(null)

  const createMutation = useMutation(queries.guardrails.create())
  const updateMutation = useMutation(queries.guardrails.update())
  const deleteMutation = useMutation(queries.guardrails.delete())
  const updateSettingsMutation = useMutation(queries.guardrails.updateSettings())
  const importMutation = useMutation(queries.guardrails.importPolicies())
  const importInput = useRef<HTMLInputElement>(null)

  const policies = overview.policies.filter((policy) => policy.scope === tab)
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
    <>
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      <SectionCard
        title="Guardrails"
        description="Content-safety policies layered global → provider → model → chain → API key. Most specific wins."
        toolbar={
          <>
            <Button
              className={PRIMARY_BUTTON_CLASS}
              disabled={importMutation.isPending}
              onClick={() => importInput.current?.click()}
            >
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
                  checked={overview.external_detectors}
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
                    onDelete={() => handleDeletePolicy(policy.id)}
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
