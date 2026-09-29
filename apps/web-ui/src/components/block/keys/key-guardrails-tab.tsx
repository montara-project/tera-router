import { IconChevronDown, IconShieldCheck, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type {
  GuardrailPolicy,
  GuardrailsPolicyConfig,
  GuardrailsScope,
} from '@/lib/api/models/guardrails'
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
import { throwAxiosError } from '@/lib/api/axios-error'
import { GUARDRAILS_QUERY_KEY, guardrailsQueries } from '@/lib/api/queries/guardrails'
import { services } from '@/lib/api/services'

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

type EffectiveDetector = {
  key: DetectorKey
  label: string
  enabled: boolean
  source: 'key' | 'inherited' | 'off'
  config?: Record<string, unknown>
}

export default function KeyGuardrailsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ policy: GuardrailPolicy; mode: 'create' | 'edit' } | null>(
    null
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mergedOpen, setMergedOpen] = useState(false)

  const overviewQuery = useQuery(guardrailsQueries.overview())
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
  const globalPolicy = useMemo(
    () => policies.find((policy) => policy.scope === 'global') ?? null,
    [policies]
  )

  const effective = useMemo(
    () => mergeDetectors(keyPolicies, globalPolicy, upstreamPolicies),
    [keyPolicies, globalPolicy, upstreamPolicies]
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })

  const saveMutation = useMutation({
    mutationFn: async (policy: GuardrailPolicy) => {
      const payload = {
        name: policy.name,
        scope: policy.scope,
        target: policy.target,
        protections: policy.protections,
        enabled: policy.enabled,
        config: policy.config,
      }
      try {
        if (policy.id === 'draft') return await services.guardrails.store(payload)
        return await services.guardrails.update(policy.id, payload)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: async (_data, policy) => {
      await invalidate()
      setDialog(null)
      toast.success(policy.id === 'draft' ? 'Key override created' : 'Key override saved')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'An error occurred'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (policy: GuardrailPolicy) => {
      try {
        await services.guardrails.update(policy.id, {
          name: policy.name,
          scope: policy.scope,
          target: policy.target,
          protections: policy.protections,
          enabled: !policy.enabled,
          config: policy.config,
        })
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: async () => {
      await invalidate()
      toast.success('Key override updated')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'An error occurred'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await services.guardrails.remove(id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: async () => {
      await invalidate()
      setDeleteId(null)
      toast.success('Key override deleted')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'An error occurred'),
  })

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
      <Card className="bg-card">
        <CardHeader>
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
                className="data-[state=checked]:bg-amber-600"
                disabled={toggleMutation.isPending}
                onCheckedChange={() => toggleMutation.mutate(policy)}
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

      <Card className="bg-card">
        <CardHeader>
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
        onSave={(updated) => saveMutation.mutate(updated)}
      />

      <SimpleAlertDialog
        confirmText="Delete"
        description="This removes the key-specific guardrail layer. Upstream global, provider, model, and chain policies keep applying."
        open={deleteId !== null}
        title="Delete this key override?"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      />
    </div>
  )
}

/**
 * Resolves the detectors that apply to a key: the key's own layer wins where it
 * configures a detector, everything else falls back to the upstream layers.
 */
function mergeDetectors(
  keyPolicies: GuardrailPolicy[],
  globalPolicy: GuardrailPolicy | null,
  upstreamPolicies: GuardrailPolicy[]
): EffectiveDetector[] {
  const upstreamConfigs = upstreamPolicies
    .map((policy) => policy.config)
    .filter((config): config is GuardrailsPolicyConfig => Boolean(config))

  return DETECTORS.map((detector) => {
    const keyConfig = pickConfig(
      keyPolicies.map((policy) => policy.config),
      detector.key
    )
    if (keyConfig) {
      return {
        key: detector.key,
        label: detector.label,
        enabled: keyConfig.enabled ?? false,
        source: keyConfig.enabled ? 'key' : 'off',
        config: keyConfig as Record<string, unknown>,
      }
    }

    const inherited = pickConfig([globalPolicy?.config, ...upstreamConfigs], detector.key)
    if (inherited) {
      return {
        key: detector.key,
        label: detector.label,
        enabled: inherited.enabled ?? false,
        source: inherited.enabled ? 'inherited' : 'off',
        config: inherited as Record<string, unknown>,
      }
    }

    // Policies saved without a config document still list their detectors by
    // name; fall back to that so the tab is not blank.
    const enabled = upstreamPolicies.some((policy) =>
      policy.protections.some((protection) =>
        detector.aliases.includes(protection.toLowerCase() as never)
      )
    )

    return {
      key: detector.key,
      label: detector.label,
      enabled,
      source: enabled ? 'inherited' : 'off',
    }
  })
}

function pickConfig(
  configs: (GuardrailsPolicyConfig | undefined)[],
  key: DetectorKey
): { enabled?: boolean } | undefined {
  for (const config of configs) {
    const section = config?.[key]
    if (section) return section
  }
  return undefined
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
