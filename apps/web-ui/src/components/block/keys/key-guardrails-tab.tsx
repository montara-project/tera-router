import { IconChevronDown, IconShieldCheck, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { GuardrailPolicy, GuardrailsScope } from '@/lib/api/models/guardrails'
import type { ApiKeyDetail } from '@/lib/api/models/key'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import EditPolicyDialog from '@/components/block/guardrails/edit-policy-dialog'
import { Badge } from '@/components/ui/badge'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

const PRIMARY_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90'

const UPSTREAM_SCOPES: GuardrailsScope[] = ['global', 'provider', 'model', 'chain']

const DETECTORS = [
  { key: 'pii', label: 'PII', aliases: ['pii'] },
  { key: 'injection', label: 'Prompt injection', aliases: ['injection', 'prompt injection'] },
  { key: 'topics', label: 'Topics', aliases: ['topics'] },
  { key: 'toxicity', label: 'Toxicity', aliases: ['toxicity'] },
  { key: 'bias', label: 'Bias', aliases: ['bias'] },
] as const

type DetectorKey = (typeof DETECTORS)[number]['key']

/** Most specific first, matching the server's ListEnabled ordering. */
const SPECIFICITY_ORDER: GuardrailsScope[] = ['key', 'chain', 'model', 'provider', 'global']

type EffectiveDetector = {
  key: DetectorKey
  label: string
  enabled: boolean
  source: 'key' | 'inherited' | 'off'
  config?: Record<string, unknown>
}

export default function KeyGuardrailsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const [dialog, setDialog] = useState<{ policy: GuardrailPolicy; mode: 'create' | 'edit' } | null>(
    null
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mergedOpen, setMergedOpen] = useState(false)

  const overviewQuery = useQuery(queries.guardrails.overview())
  const policies = useMemo(() => overviewQuery.data?.data.policies ?? [], [overviewQuery.data])

  // Key-scoped policies target the key id, which is unambiguous; a name could
  // collide with another key.
  const keyPolicies = useMemo(
    () => policies.filter((policy) => policy.scope === 'key' && policy.target === apiKey.id),
    [policies, apiKey.id]
  )
  const upstreamPolicies = useMemo(
    () => policies.filter((policy) => UPSTREAM_SCOPES.includes(policy.scope) && policy.enabled),
    [policies]
  )

  const effective = useMemo(
    () => mergeDetectors(keyPolicies, upstreamPolicies),
    [keyPolicies, upstreamPolicies]
  )
  const activeDetectors = effective.filter((detector) => detector.enabled)

  const draftPolicy = useMemo<GuardrailPolicy>(
    () => ({
      id: 'draft',
      name: `${apiKey.name} policy`,
      enabled: true,
      scope: 'key',
      target: apiKey.id,
      protections: [],
    }),
    [apiKey.id, apiKey.name]
  )

  const createMutation = useMutation(queries.guardrails.create())
  const updateMutation = useMutation(queries.guardrails.update())
  const deleteMutation = useMutation(queries.guardrails.delete())

  const toPolicyDto = (policy: GuardrailPolicy) => ({
    name: policy.name,
    scope: policy.scope,
    target: policy.target,
    protections: policy.protections,
    enabled: policy.enabled,
    config: policy.config,
  })

  const handleSave = (policy: GuardrailPolicy) => {
    const isDraft = policy.id === 'draft'
    const options = {
      onSuccess: () => {
        setDialog(null)
        toast.success(isDraft ? 'Key override created' : 'Key override saved')
      },
      onError: toastAxiosError,
    }

    if (isDraft) {
      createMutation.mutate(toPolicyDto(policy), options)
    } else {
      updateMutation.mutate({ id: policy.id, reqBody: toPolicyDto(policy) }, options)
    }
  }

  const handleToggle = (policy: GuardrailPolicy) => {
    updateMutation.mutate(
      { id: policy.id, reqBody: toPolicyDto({ ...policy, enabled: !policy.enabled }) },
      {
        onSuccess: () => toast.success('Key override updated'),
        onError: toastAxiosError,
      }
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteId(null)
        toast.success('Key override deleted')
      },
      onError: toastAxiosError,
    })
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-background">
        <CardHeader className="h-20">
          <CardHeading>
            <CardTitle>Per-key guardrails</CardTitle>
            <CardDescription>
              Add a key-specific layer only when this key needs different protection from upstream
              policies.
            </CardDescription>
          </CardHeading>
          <CardToolbar>
            <Button
              variant="outline"
              onClick={() => setDialog({ policy: draftPolicy, mode: 'create' })}
            >
              Create override
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="bg-background flex items-start gap-4 rounded-lg border border-border p-4">
            <span className="bg-muted mt-1.5 size-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Inherited policy</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Global, provider, model, and chain policies continue to apply.
              </p>
              {upstreamPolicies.length > 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Currently inherited:{' '}
                  <span className="text-foreground">
                    {upstreamPolicies
                      .map((policy) => `${policy.name} (${policy.scope})`)
                      .join(', ')}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          {keyPolicies.map((policy) => (
            <div
              key={policy.id}
              className="bg-background flex flex-wrap items-center gap-4 rounded-lg border border-border p-4"
            >
              <IconShieldCheck className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{policy.name}</p>
                  <Badge
                    variant={policy.enabled ? 'success' : 'secondary'}
                    appearance="light"
                    size="sm"
                  >
                    {policy.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  {policy.protections.length > 0
                    ? policy.protections.join(' · ')
                    : 'No detectors enabled'}
                </p>
              </div>
              <Switch
                aria-label={`Toggle ${policy.name}`}
                checked={policy.enabled}
                disabled={updateMutation.isPending}
                onCheckedChange={() => handleToggle(policy)}
              />
              <Button
                className={PRIMARY_BUTTON_CLASS}
                size="sm"
                onClick={() => setDialog({ policy, mode: 'edit' })}
              >
                Edit
              </Button>
              <Button
                aria-label={`Delete ${policy.name}`}
                size="icon"
                variant="secondary"
                onClick={() => setDeleteId(policy.id)}
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="h-20">
          <CardHeading>
            <CardTitle>Effective protection</CardTitle>
            <CardDescription>
              The final policy after all applicable guardrail layers are merged.
            </CardDescription>
          </CardHeading>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          {activeDetectors.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No detector is enabled for this key. Requests pass through unmodified.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {activeDetectors.map((detector) => (
                <Badge key={detector.key} variant="success" appearance="light" size="md">
                  {detector.label}
                </Badge>
              ))}
              <span className="text-muted-foreground ml-1 text-xs">
                {activeDetectors.length} active{' '}
                {activeDetectors.length === 1 ? 'detector' : 'detectors'}
              </span>
            </div>
          )}

          <Collapsible open={mergedOpen} onOpenChange={setMergedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="bg-background hover:bg-accent/40 flex w-full cursor-pointer items-center justify-between rounded-lg border border-border px-4 py-3 text-left text-sm font-medium transition-colors"
              >
                View merged configuration
                <IconChevronDown
                  className={`h-4 w-4 transition-transform ${mergedOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="divide-border divide-y rounded-lg border border-border">
                {effective.map((detector) => (
                  <div key={detector.key} className="space-y-1.5 p-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{detector.label}</p>
                      <Badge
                        variant={detector.enabled ? 'success' : 'secondary'}
                        appearance="light"
                        size="xs"
                      >
                        {detector.enabled ? 'Enabled' : 'Off'}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {detector.source === 'key'
                          ? 'key override'
                          : detector.source === 'inherited'
                            ? 'inherited'
                            : 'not configured'}
                      </span>
                    </div>
                    <p className="text-muted-foreground font-mono text-xs">
                      {describeConfig(detector.config)}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <EditPolicyDialog
        mode={dialog?.mode ?? 'create'}
        policy={dialog?.policy ?? null}
        onOpenChange={(open) => !open && setDialog(null)}
        onSave={handleSave}
      />

      <SimpleAlertDialog
        confirmText="Delete"
        description="This removes the key-specific guardrail layer. Upstream global, provider, model, and chain policies keep applying."
        open={deleteId !== null}
        title="Delete this key override?"
        variant="destructive"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      />
    </div>
  )
}

/**
 * Resolves the detectors that apply to a key.
 *
 * This mirrors the server's merge in the guardrails Evaluate path: layers are
 * walked most-specific-first, a detector counts as active if ANY applicable
 * layer enables it (a key override cannot switch off upstream protection), and
 * the settings shown come from the most specific layer that enables it.
 */
function mergeDetectors(
  keyPolicies: GuardrailPolicy[],
  upstreamPolicies: GuardrailPolicy[]
): EffectiveDetector[] {
  // Most specific first: key, chain, model, provider, global.
  const layers = [...keyPolicies, ...sortBySpecificity(upstreamPolicies)]

  return DETECTORS.map((detector) => {
    let config: { enabled?: boolean } | undefined
    let source: EffectiveDetector['source'] = 'off'
    let enabled = false

    for (const policy of layers) {
      const section = policy.config?.[detector.key]
      // A policy saved without a config document still names its detectors.
      const named = policy.protections.some((protection) =>
        detector.aliases.includes(protection.toLowerCase() as never)
      )

      if (section?.enabled) {
        enabled = true
        if (!config) {
          config = section
          source = policy.scope === 'key' ? 'key' : 'inherited'
        }
      } else if (named) {
        enabled = true
        if (!config) source = policy.scope === 'key' ? 'key' : 'inherited'
      }
    }

    return {
      key: detector.key,
      label: detector.label,
      enabled,
      source: enabled ? source : 'off',
      config: config as Record<string, unknown> | undefined,
    }
  })
}

/** Orders policies by scope specificity, most specific first. */
function sortBySpecificity(policies: GuardrailPolicy[]) {
  return [...policies].sort(
    (a, b) => SPECIFICITY_ORDER.indexOf(a.scope) - SPECIFICITY_ORDER.indexOf(b.scope)
  )
}

function describeConfig(config?: Record<string, unknown>) {
  if (!config) return 'no configuration saved'

  const parts = Object.entries(config)
    .filter(([key, value]) => key !== 'enabled' && !isEmpty(value))
    .map(
      ([key, value]) =>
        `${humanize(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`
    )

  return parts.length > 0 ? parts.join(' · ') : 'defaults'
}

function isEmpty(value: unknown) {
  if (value === undefined || value === null || value === '') return true
  return Array.isArray(value) && value.length === 0
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}
